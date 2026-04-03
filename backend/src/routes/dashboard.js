import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

// ─── DATA SOURCES (confirmed by Samir 27-03-2026) ────────────────────────────
// Solmar / Interbus / Solmar DE  →  CustomerOverview  (Status: DEF / DEF-GEANNULEERD)
// Snowtravel                     →  ST_Bookings       (status: ok / cancelled)
// Bus Pendel                     →  BUStrips
// Bus Feeder                     →  FeederOverview
// Bus Deck                       →  solmar_bus_deck_weekly
// Bus Class KPIs                 →  solmar_bus_bookings_modified

// ─── STATUS CONSTANTS ────────────────────────────────────────────────────────
const CO_ALL  = `Status IN ('DEF','DEF-GEANNULEERD')`;
const CO_CONF = `Status = 'DEF'`;
const ST_ALL  = `status IN ('ok','cancelled')`;
const ST_CONF = `status = 'ok'`;

// ─── OVERVIEW WHERE BUILDER ───────────────────────────────────────────────────
function buildOverviewWhere(q) {
  const coC=[], coP={}, stC=[], stP={};

  if (q.departureDateFrom) {
    coC.push('DepartureDate>=@codf'); coP.codf=q.departureDateFrom;
    stC.push('dateDeparture>=@stdf'); stP.stdf=q.departureDateFrom;
  }
  if (q.departureDateTo) {
    coC.push('DepartureDate<=@codt'); coP.codt=q.departureDateTo;
    stC.push('dateDeparture<=@stdt'); stP.stdt=q.departureDateTo;
  }
  if (q.bookingDateFrom) {
    coC.push('CAST(BookingDate AS DATE)>=@cobf'); coP.cobf=q.bookingDateFrom;
    stC.push('CAST(creationTime AS DATE)>=@stbf'); stP.stbf=q.bookingDateFrom;
  }
  if (q.bookingDateTo) {
    coC.push('CAST(BookingDate AS DATE)<=@cobt'); coP.cobt=q.bookingDateTo;
    stC.push('CAST(creationTime AS DATE)<=@stbt'); stP.stbt=q.bookingDateTo;
  }

  const ds = [].concat(q.dataset||[]).filter(Boolean);
  const solmarDs = ds.filter(d=>['Solmar','Interbus','Solmar DE'].includes(d));
  const hasSnow  = !ds.length || ds.includes('Snowtravel');
  const hasSolmar= !ds.length || solmarDs.length>0;

  if (solmarDs.length) {
    solmarDs.forEach((d,i)=>{ coP[`cods${i}`]=d; });
    coC.push(`(${solmarDs.map((_,i)=>`Dataset=@cods${i}`).join(' OR ')})`);
  }

  // Status filter
  const st = [].concat(q.status||[]).filter(Boolean);
  if (st.length) {
    if (st.includes('ok') && !st.includes('cancelled')) {
      coC.push(`Status='DEF'`); stC.push(`status='ok'`);
    } else if (st.includes('cancelled') && !st.includes('ok')) {
      coC.push(`Status='DEF-GEANNULEERD'`); stC.push(`status='cancelled'`);
    }
  }

  // Year filter
  const yr = [].concat(q.year||[]).filter(Boolean).map(Number);
  if (yr.length) {
    yr.forEach((y,i)=>{ coP[`coyr${i}`]=y; stP[`styr${i}`]=y; });
    coC.push(`(${yr.map((_,i)=>`DepartureYear=@coyr${i}`).join(' OR ')})`);
    stC.push(`(${yr.map((_,i)=>`YEAR(dateDeparture)=@styr${i}`).join(' OR ')})`);
  }

  return {
    coWhere: `WHERE ${[CO_ALL,...coC].join(' AND ')}`,
    coP,
    stWhere: `WHERE ${[ST_ALL,...stC].join(' AND ')}`,
    stP,
    hasSolmar,
    hasSnow,
  };
}

function buildUnion(coWhere, stWhere, hasSolmar, hasSnow, coExtra='', stExtra='') {
  const co = `SELECT ${coExtra}DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue, Dataset AS dataset FROM CustomerOverview ${coWhere}`;
  const st = `SELECT ${stExtra}YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue, 'Snowtravel' AS dataset FROM ST_Bookings ${stWhere}`;
  if (!hasSolmar && hasSnow) return { sql: st, p: {} };
  if (hasSolmar && !hasSnow)  return { sql: co, p: {} };
  return { sql: `${co} UNION ALL ${st}`, p: {} };
}

// ─── SLICERS ──────────────────────────────────────────────────────────────────
router.get('/slicers', async (req,res)=>{
  try {
    const r = await query(`SELECT DISTINCT LOWER(REPLACE(TransportType,'ownTransport','own transport')) AS t FROM CustomerOverview WHERE TransportType IS NOT NULL AND ${CO_ALL} ORDER BY t`);
    res.json({ transportTypes:[...new Set((r.recordset||[]).map(x=>x.t).filter(Boolean))] });
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── KPIs ─────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req,res)=>{
  try {
    const datasets=[].concat(req.query.dataset||[]).filter(Boolean);
    const years=[].concat(req.query.year||[]).filter(Boolean).map(Number);
    const hasDate=!!(req.query.departureDateFrom||req.query.departureDateTo);
    const curY=new Date().getFullYear(), prevY=curY-1;
    const {coWhere,coP,stWhere,stP,hasSolmar,hasSnow}=buildOverviewWhere(req.query);

    const coBase=`SELECT DepartureYear AS yr,PAXCount AS pax,TotalRevenue AS revenue,CASE WHEN Status='DEF' THEN 'ok' ELSE 'cancelled' END AS ns FROM CustomerOverview ${coWhere}`;
    const stBase=`SELECT YEAR(dateDeparture) AS yr,paxCount AS pax,totalPrice AS revenue,status AS ns FROM ST_Bookings ${stWhere}`;

    let unionSql, p;
    if (!hasSolmar&&hasSnow)     { unionSql=stBase; p=stP; }
    else if (hasSolmar&&!hasSnow){ unionSql=coBase; p=coP; }
    else                          { unionSql=`${coBase} UNION ALL ${stBase}`; p={...coP,...stP}; }

    // ── KPI: Compare current date range vs same period previous year ─────────────
    let sql, periodLabel, prevLabel, p2={};

    const dateFrom = req.query.departureDateFrom;
    const dateTo   = req.query.departureDateTo;

    if (hasDate && (dateFrom||dateTo)) {
      // User selected a date range → compare same range -1 year
      const shiftYear = s => s ? s.replace(/^(\d{4})/, y=>String(parseInt(y)-1)) : null;
      const prevFrom  = shiftYear(dateFrom);
      const prevTo    = shiftYear(dateTo);
      periodLabel = `${dateFrom||''}${dateTo?' – '+dateTo:''}`;
      prevLabel   = `${prevFrom||''}${prevTo?' – '+prevTo:''}`;

      // Build previous period WHERE (same filters but -1 year on dates)
      const coCurr = coWhere;
      const coPrev = coWhere
        .replace('@codf', '@codf2').replace('@codt', '@codt2');
      const p2co = {...coP};
      if (dateFrom) p2co.codf2 = prevFrom;
      if (dateTo)   p2co.codt2 = prevTo;

      // Build ST prev WHERE
      const stPrev = stWhere
        .replace('@stdf', '@stdf2').replace('@stdt', '@stdt2');
      const p2st = {...stP};
      if (dateFrom) p2st.stdf2 = prevFrom;
      if (dateTo)   p2st.stdt2 = prevTo;

      // Curr query
      const coBaseCurr = `SELECT PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coCurr}`;
      const stBaseCurr = `SELECT paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere}`;
      let currSql;
      if (!hasSolmar&&hasSnow) currSql=stBaseCurr;
      else if(hasSolmar&&!hasSnow) currSql=coBaseCurr;
      else currSql=`${coBaseCurr} UNION ALL ${stBaseCurr}`;

      // Prev query (replace date params with prev year values)
      const coBasePrev = `SELECT PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coPrev}`;
      const stBasePrev = `SELECT paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stPrev}`;
      let prevSql;
      if (!hasSolmar&&hasSnow) prevSql=stBasePrev;
      else if(hasSolmar&&!hasSnow) prevSql=coBasePrev;
      else prevSql=`${coBasePrev} UNION ALL ${stBasePrev}`;

      const allP = {...coP,...stP,...p2co,...p2st};
      sql = `SELECT
        (SELECT COUNT(*) FROM (${currSql}) t) AS cb,
        (SELECT ISNULL(SUM(pax),0) FROM (${currSql}) t) AS cp,
        (SELECT ISNULL(ROUND(SUM(revenue),2),0) FROM (${currSql}) t) AS cr,
        (SELECT COUNT(*) FROM (${prevSql}) t) AS pb,
        (SELECT ISNULL(SUM(pax),0) FROM (${prevSql}) t) AS pp,
        (SELECT ISNULL(ROUND(SUM(revenue),2),0) FROM (${prevSql}) t) AS pr`;
      p2 = allP;

    } else if (years.length===1) {
      const yr=years[0]; periodLabel=`Year ${yr}`; prevLabel=`Year ${yr-1}`;
      sql=`SELECT SUM(CASE WHEN yr=${yr} THEN revenue ELSE 0 END) AS cr,SUM(CASE WHEN yr=${yr-1} THEN revenue ELSE 0 END) AS pr,SUM(CASE WHEN yr=${yr} THEN pax ELSE 0 END) AS cp,SUM(CASE WHEN yr=${yr-1} THEN pax ELSE 0 END) AS pp,COUNT(CASE WHEN yr=${yr} THEN 1 END) AS cb,COUNT(CASE WHEN yr=${yr-1} THEN 1 END) AS pb FROM (${unionSql}) t`;
    } else {
      periodLabel=`${curY} vs ${prevY}`; prevLabel=String(prevY);
      sql=`SELECT SUM(CASE WHEN yr=${curY} THEN revenue ELSE 0 END) AS cr,SUM(CASE WHEN yr=${prevY} THEN revenue ELSE 0 END) AS pr,SUM(CASE WHEN yr=${curY} THEN pax ELSE 0 END) AS cp,SUM(CASE WHEN yr=${prevY} THEN pax ELSE 0 END) AS pp,COUNT(CASE WHEN yr=${curY} THEN 1 END) AS cb,COUNT(CASE WHEN yr=${prevY} THEN 1 END) AS pb FROM (${unionSql}) t`;
    }

    const r=(await query(sql, hasDate&&(dateFrom||dateTo) ? p2 : p)).recordset[0]||{};
    const cb=r.cb||0,pb=r.pb||0,cp=r.cp||0,pp=r.pp||0,cr=parseFloat(r.cr)||0,pr=parseFloat(r.pr)||0;
    res.json({currentBookings:cb,previousBookings:pb,differenceBookings:cb-pb,percentBookings:pb>0?(cb-pb)/pb*100:null,currentPax:cp,previousPax:pp,differencePax:cp-pp,percentPax:pp>0?(cp-pp)/pp*100:null,currentRevenue:cr,previousRevenue:pr,differenceRevenue:cr-pr,percentRevenue:pr>0?(cr-pr)/pr*100:null,periodLabel,prevLabel});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── REVENUE BY YEAR ──────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req,res)=>{
  try {
    const {coWhere,coP,stWhere,stP,hasSolmar,hasSnow}=buildOverviewWhere(req.query);
    const co=`SELECT DepartureYear AS yr,DepartureMonth AS mo,PAXCount AS pax,TotalRevenue AS revenue FROM CustomerOverview ${coWhere} AND DepartureYear BETWEEN 2022 AND 2027`;
    const st=`SELECT YEAR(dateDeparture) AS yr,MONTH(dateDeparture) AS mo,paxCount AS pax,totalPrice AS revenue FROM ST_Bookings ${stWhere} AND YEAR(dateDeparture) BETWEEN 2022 AND 2027`;
    let sql,p;
    if (!hasSolmar&&hasSnow){sql=st;p=stP;}
    else if(hasSolmar&&!hasSnow){sql=co;p=coP;}
    else{sql=`${co} UNION ALL ${st}`;p={...coP,...stP};}
    const r=await query(`SELECT yr AS year,mo AS month,COUNT(*) AS bookings,SUM(pax) AS pax,ROUND(SUM(revenue),2) AS revenue FROM (${sql}) t GROUP BY yr,mo ORDER BY yr ASC,mo ASC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── YEAR-MONTH COMPARISON ────────────────────────────────────────────────────
router.get('/year-month-comparison', async (req,res)=>{
  try {
    // Build WHERE without year filter — we handle years manually for YoY
    const reqNoYear = {...req.query}; delete reqNoYear.year;
    const {coWhere,coP,stWhere,stP,hasSolmar,hasSnow}=buildOverviewWhere(reqNoYear);

    // Determine years: if user selected specific years, load those + their previous year
    const selYears=[].concat(req.query.year||[]).filter(Boolean).map(Number);
    const displayYears=selYears.length>0 ? selYears : null;
    // Years to load into CTE = display years + each minus 1
    const loadYears=displayYears
      ? [...new Set([...displayYears,...displayYears.map(y=>y-1)])]
      : null; // null = use BETWEEN range

    // Build year range condition params (avoid collision with coP/stP)
    const coYP={}, stYP={};
    let coYCond='', stYCond='';
    if(loadYears){
      loadYears.forEach((y,i)=>{ coYP[`lyr${i}`]=y; stYP[`slyr${i}`]=y; });
      coYCond=` AND DepartureYear IN (${loadYears.map((_,i)=>`@lyr${i}`).join(',')})`;
      stYCond=` AND YEAR(dateDeparture) IN (${loadYears.map((_,i)=>`@slyr${i}`).join(',')})`;
    } else {
      coYCond=' AND DepartureYear BETWEEN 2021 AND 2027';
      stYCond=' AND YEAR(dateDeparture) BETWEEN 2021 AND 2027';
    }

    const co=`SELECT DepartureYear AS yr,DepartureMonth AS mo,PAXCount AS pax,TotalRevenue AS revenue FROM CustomerOverview ${coWhere}${coYCond}`;
    const st=`SELECT YEAR(dateDeparture) AS yr,MONTH(dateDeparture) AS mo,paxCount AS pax,totalPrice AS revenue FROM ST_Bookings ${stWhere}${stYCond}`;

    let unionSql,p;
    if(!hasSolmar&&hasSnow){unionSql=st;p={...stP,...stYP};}
    else if(hasSolmar&&!hasSnow){unionSql=co;p={...coP,...coYP};}
    else{unionSql=`${co} UNION ALL ${st}`;p={...coP,...stP,...coYP,...stYP};}

    // Outer WHERE: only show rows for selected (display) years
    const outerYP={};
    let outerWhere='';
    if(displayYears&&displayYears.length>0){
      displayYears.forEach((y,i)=>{ outerYP[`dyr${i}`]=y; });
      outerWhere=`WHERE ${displayYears.map((_,i)=>`a.year=@dyr${i}`).join(' OR ')}`;
      Object.assign(p,outerYP);
    }

    const sql=`WITH base AS (
      SELECT yr AS year,mo AS month,
        COUNT(*) AS bookings,SUM(pax) AS pax,ROUND(SUM(revenue),2) AS revenue
      FROM (${unionSql}) t GROUP BY yr,mo
    )
    SELECT
      a.year AS currentYear, a.year-1 AS previousYear,
      a.month,
      a.bookings AS currentBookings, ISNULL(b.bookings,0) AS previousBookings,
      a.pax AS currentPax, ISNULL(b.pax,0) AS previousPax,
      a.revenue AS currentRevenue, ISNULL(b.revenue,0) AS previousRevenue,
      a.bookings-ISNULL(b.bookings,0) AS diffBookings,
      a.pax-ISNULL(b.pax,0) AS diffPax,
      ROUND(a.revenue-ISNULL(b.revenue,0),2) AS diffRevenue,
      CASE WHEN ISNULL(b.bookings,0)>0 THEN ROUND((CAST(a.bookings AS FLOAT)-b.bookings)/b.bookings*100,1) ELSE NULL END AS diffPctBookings,
      CASE WHEN ISNULL(b.pax,0)>0 THEN ROUND((CAST(a.pax AS FLOAT)-b.pax)/b.pax*100,1) ELSE NULL END AS diffPctPax,
      CASE WHEN ISNULL(b.revenue,0)>0 THEN ROUND((a.revenue-b.revenue)/b.revenue*100,1) ELSE NULL END AS diffPctRevenue
    FROM base a
    LEFT JOIN base b ON b.year=a.year-1 AND b.month=a.month
    ${outerWhere}
    ORDER BY a.year DESC,a.month DESC`;

    const r=await query(sql,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});
// ✅ FIXED DECK CLASS ENDPOINT using real table: solmar_bus_deck_choice
router.get('/deck-class', async (req, res) => {
  try {

    // Build WHERE (correct columns)
    const conds = [];
    const p = {};

    if (req.query.dateFrom) {
      conds.push("dateDeparture >= @df");
      p.df = req.query.dateFrom;
    }

    if (req.query.dateTo) {
      conds.push("dateDeparture <= @dt");
      p.dt = req.query.dateTo;
    }

    if (req.query.region) {
      conds.push("Region = @rg");
      p.rg = req.query.region;
    }

    if (req.query.pendel) {
      conds.push("Pendel_Outbound LIKE @pd");
      p.pd = `%${req.query.pendel}%`;
    }

    if (req.query.status && req.query.status !== "all") {
      conds.push("Status = @st");
      p.st = req.query.status;
    }

    if (req.query.weekday) {
      conds.push("DATENAME(weekday, dateDeparture) = @wd");
      p.wd = req.query.weekday;
    }

    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

    // ✅ Correct SQL using actual columns from solmar_bus_deck_choice
    const sql = `
      SELECT
        CONVERT(VARCHAR(10), dateDeparture, 103) AS dateDeparture,

        -- Total
        SUM(PAX) AS Total,
        SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_Lower,
        SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_Upper,
        SUM(CASE WHEN Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL THEN PAX ELSE 0 END) AS Total_NoDeck,

        -- Royal
        SUM(CASE WHEN Outbound_Class = 'Royal Class' THEN PAX ELSE 0 END) AS Royal_Total,
        SUM(CASE WHEN Outbound_Class = 'Royal Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_Lower,
        SUM(CASE WHEN Outbound_Class = 'Royal Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_Upper,
        SUM(CASE WHEN Outbound_Class = 'Royal Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Royal_NoDeck,

        -- First Class
        SUM(CASE WHEN Outbound_Class = 'First Class' THEN PAX ELSE 0 END) AS First_Total,
        SUM(CASE WHEN Outbound_Class = 'First Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_Lower,
        SUM(CASE WHEN Outbound_Class = 'First Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_Upper,
        SUM(CASE WHEN Outbound_Class = 'First Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS First_NoDeck,

        -- Premium
        SUM(CASE WHEN Outbound_Class = 'Premium Class' THEN PAX ELSE 0 END) AS Premium_Total,
        SUM(CASE WHEN Outbound_Class = 'Premium Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_Lower,
        SUM(CASE WHEN Outbound_Class = 'Premium Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_Upper,
        SUM(CASE WHEN Outbound_Class = 'Premium Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Premium_NoDeck

      FROM solmar_bus_deck_choice
      ${where}
      GROUP BY dateDeparture
      ORDER BY CAST(dateDeparture AS DATE) ASC
    `;

    const r = await query(sql, p);
    res.json(r.recordset || []);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── BUS SLICERS ──────────────────────────────────────────────────────────────
router.get('/bus-slicers', async (req,res)=>{
  try {
    const [pendels,regions,statuses,feederLines]=await Promise.all([
      query(`SELECT DISTINCT Pendel_Outbound AS val FROM solmar_bus_bookings_modified WHERE Pendel_Outbound IS NOT NULL AND LTRIM(RTRIM(Pendel_Outbound))!='' ORDER BY Pendel_Outbound`),
      query(`SELECT DISTINCT Region AS val FROM solmar_bus_bookings_modified WHERE Region IS NOT NULL AND LTRIM(RTRIM(Region))!='' ORDER BY Region`),
      query(`SELECT DISTINCT Status AS val FROM solmar_bus_bookings_modified WHERE Status IS NOT NULL AND LTRIM(RTRIM(Status))!='' ORDER BY Status`),
      query(`SELECT DISTINCT FeederLine AS val FROM FeederOverview WHERE FeederLine IS NOT NULL ORDER BY FeederLine`),
    ]);
    res.json({
      pendels:(pendels.recordset||[]).map(r=>r.val),
      regions:(regions.recordset||[]).map(r=>r.val),
      statuses:(statuses.recordset||[]).map(r=>r.val),
      feederLines:(feederLines.recordset||[]).map(r=>r.val),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── BUS KPI CARDS ────────────────────────────────────────────────────────────
router.get('/bus-kpis', async (req,res)=>{
  try {
    const {where,params}=buildBusWhere(req.query);
    const r=await query(`SELECT
      SUM(PAX) AS total_pax,
      COUNT(DISTINCT id) AS total_bookings,
      SUM(CASE WHEN Outbound_Class='Royal Class' THEN PAX ELSE 0 END) AS royal_pax,
      SUM(CASE WHEN Outbound_Class='First Class' THEN PAX ELSE 0 END) AS first_pax,
      SUM(CASE WHEN Outbound_Class='Premium Class' THEN PAX ELSE 0 END) AS premium_pax,
      SUM(CASE WHEN Outbound_Class='Comfort Class' THEN PAX ELSE 0 END) AS comfort_pax,
      SUM(CASE WHEN Outbound_Class='Standard' THEN PAX ELSE 0 END) AS standard_pax,
      SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS lower_pax,
      SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS upper_pax,
      SUM(CASE WHEN Outbound_Deck LIKE '%Geen%' THEN PAX ELSE 0 END) AS no_deck_pax
      FROM solmar_bus_bookings_modified ${where}`,params);
    res.json(r.recordset[0]||{});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── PENDEL OVERVIEW ──────────────────────────────────────────────────────────
router.get('/pendel-overview', async (req,res)=>{
  try {
    const {where,params}=buildBustripsWhere(req.query);
    const r=await query(`SELECT
      CONVERT(VARCHAR(10),StartDate,105) AS StartDate,
      CONVERT(VARCHAR(10),EndDate,105) AS EndDate,
      SUM(ORC) AS ORC, SUM(OFC) AS OFC, SUM(OPRE) AS OPRE,
      SUM(OTotal) AS Outbound_Total,
      SUM(RRC) AS RRC, SUM(RFC) AS RFC, SUM(RPRE) AS RPRE,
      SUM(RTotal) AS Inbound_Total,
      SUM(RC_Diff) AS Diff_Royal,
      SUM(FC_Diff) AS Diff_First,
      SUM(PRE_Diff) AS Diff_Premium,
      SUM(Total_Difference) AS Diff_Total
      FROM BUStrips ${where}
      GROUP BY StartDate,EndDate
      ORDER BY CAST(StartDate AS DATE) ASC`,params);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── FEEDER OVERVIEW ──────────────────────────────────────────────────────────
router.get('/feeder-overview', async (req,res)=>{
  try {
    const conds=[],p={};
    if(req.query.dateFrom){conds.push('DepartureDate>=@df');p.df=req.query.dateFrom;}
    if(req.query.dateTo){conds.push('DepartureDate<=@dt');p.dt=req.query.dateTo;}
    if(req.query.feederLine){conds.push('FeederLine=@fl');p.fl=req.query.feederLine;}
    if(req.query.label){conds.push('LabelName=@lb');p.lb=req.query.label;}
    const where=conds.length?'WHERE '+conds.join(' AND '):'';
    const r=await query(`SELECT
      CONVERT(VARCHAR(10),DepartureDate,105) AS DepartureDate,
      LabelName,FeederLine,RouteNo,RouteLabel,StopName,StopType,
      SUM(TotalPax) AS TotalPax,SUM(BookingCount) AS BookingCount
      FROM FeederOverview ${where}
      GROUP BY DepartureDate,LabelName,FeederLine,RouteNo,RouteLabel,StopName,StopType
      ORDER BY DepartureDate ASC,RouteNo ASC,StopName ASC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── DECK CLASS ───────────────────────────────────────────────────────────────
router.get('/deck-class', async (req,res)=>{
  try {
    const {where,params}=buildBusWhere(req.query);
    const r=await query(`SELECT
      CONVERT(VARCHAR(10),dateDeparture,103) AS dateDeparture,
      SUM(PAX) AS Total,
      SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_Lower,
      SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_Upper,
      SUM(CASE WHEN Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL THEN PAX ELSE 0 END) AS Total_NoDeck,
      SUM(CASE WHEN Outbound_Class='Royal Class' THEN PAX ELSE 0 END) AS Royal_Total,
      SUM(CASE WHEN Outbound_Class='Royal Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_Lower,
      SUM(CASE WHEN Outbound_Class='Royal Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_Upper,
      SUM(CASE WHEN Outbound_Class='Royal Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Royal_NoDeck,
      SUM(CASE WHEN Outbound_Class='First Class' THEN PAX ELSE 0 END) AS First_Total,
      SUM(CASE WHEN Outbound_Class='First Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_Lower,
      SUM(CASE WHEN Outbound_Class='First Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_Upper,
      SUM(CASE WHEN Outbound_Class='First Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS First_NoDeck,
      SUM(CASE WHEN Outbound_Class='Premium Class' THEN PAX ELSE 0 END) AS Premium_Total,
      SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_Lower,
      SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_Upper,
      SUM(CASE WHEN Outbound_Class='Premium Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Premium_NoDeck,
      SUM(CASE WHEN Outbound_Class='Comfort Class' THEN PAX ELSE 0 END) AS Comfort_Total,
      SUM(CASE WHEN Outbound_Class='Comfort Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Comfort_Lower,
      SUM(CASE WHEN Outbound_Class='Comfort Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Comfort_Upper,
      SUM(CASE WHEN Outbound_Class='Comfort Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Comfort_NoDeck
      FROM solmar_bus_bookings_modified ${where}
      GROUP BY dateDeparture
      ORDER BY CAST(dateDeparture AS DATE) ASC`,params);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});
// ─── DATA TABLE ───────────────────────────────────────────────────────────────
router.get('/bookings-table', async (req,res)=>{
  try {
    const dsParam=req.query.dataset||'';
    const isSnow=dsParam==='Snowtravel';
    const isOther=dsParam&&dsParam!=='Snowtravel';
    const page=Math.max(1,parseInt(req.query.page)||1);
    const limit=Math.min(100,parseInt(req.query.limit)||50);
    const off=(page-1)*limit;

    const coC=[CO_ALL],coP={};
    if(isOther){coC.push('Dataset=@cods');coP.cods=dsParam;}
    if(req.query.status==='ok')coC[0]="Status='DEF'";
    else if(req.query.status==='cancelled')coC[0]="Status='DEF-GEANNULEERD'";
    if(req.query.depFrom){coC.push('DepartureDate>=@codf');coP.codf=req.query.depFrom;}
    if(req.query.depTo){coC.push('DepartureDate<=@codt');coP.codt=req.query.depTo;}
    if(req.query.bkFrom){coC.push('CAST(BookingDate AS DATE)>=@cobf');coP.cobf=req.query.bkFrom;}
    if(req.query.bkTo){coC.push('CAST(BookingDate AS DATE)<=@cobt');coP.cobt=req.query.bkTo;}
    if(req.query.search){coC.push('(BookingID LIKE @cos OR LabelName LIKE @cos)');coP.cos=`%${req.query.search}%`;}
    const coW='WHERE '+coC.join(' AND ');

    const stC=[ST_ALL],stP={};
    if(req.query.status&&req.query.status!=='all'){stC[0]=`status=@stst`;stP.stst=req.query.status;}
    if(req.query.depFrom){stC.push('dateDeparture>=@stdf');stP.stdf=req.query.depFrom;}
    if(req.query.depTo){stC.push('dateDeparture<=@stdt');stP.stdt=req.query.depTo;}
    if(req.query.bkFrom){stC.push('CAST(creationTime AS DATE)>=@stbf');stP.stbf=req.query.bkFrom;}
    if(req.query.bkTo){stC.push('CAST(creationTime AS DATE)<=@stbt');stP.stbt=req.query.bkTo;}
    if(req.query.search){stC.push('(CAST(travelFileId AS VARCHAR) LIKE @sts)');stP.sts=`%${req.query.search}%`;}
    const stW='WHERE '+stC.join(' AND ');

    const coSel=`SELECT BookingID,Dataset,CASE WHEN Status='DEF' THEN 'ok' WHEN Status='DEF-GEANNULEERD' THEN 'cancelled' ELSE Status END AS Status,LabelName AS Label,CONVERT(VARCHAR(10),BookingDate,103) AS BookingDate,CONVERT(VARCHAR(10),DepartureDate,103) AS DepartureDate,CONVERT(VARCHAR(10),ReturnDate,103) AS ReturnDate,DATEDIFF(day,DepartureDate,ReturnDate) AS Duration,PAXCount AS PAX,ROUND(TotalRevenue,2) AS Revenue,ROUND(CASE WHEN PAXCount>0 THEN TotalRevenue/PAXCount ELSE 0 END,2) AS RevPerPax,TransportType,BusType,DeparturePlace,CustomerCity AS City,CustomerCountry AS Country,DestinationResort AS Destination,DepartureYear AS Year,DepartureMonth AS Month FROM CustomerOverview ${coW}`;
    const stSel=`SELECT CAST(travelFileId AS VARCHAR) AS BookingID,'Snowtravel' AS Dataset,status AS Status,'Snowtravel' AS Label,CONVERT(VARCHAR(10),creationTime,103) AS BookingDate,CONVERT(VARCHAR(10),dateDeparture,103) AS DepartureDate,CONVERT(VARCHAR(10),dateReturn,103) AS ReturnDate,DATEDIFF(day,dateDeparture,dateReturn) AS Duration,paxCount AS PAX,ROUND(totalPrice,2) AS Revenue,ROUND(CASE WHEN paxCount>0 THEN totalPrice/paxCount ELSE 0 END,2) AS RevPerPax,wayOfTransport AS TransportType,busType AS BusType,departurePlace AS DeparturePlace,customerCity AS City,customerCountry AS Country,residence AS Destination,YEAR(dateDeparture) AS Year,MONTH(dateDeparture) AS Month FROM ST_Bookings ${stW}`;

    let rowsSql,cntSql,allP;
    if(isSnow){rowsSql=`${stSel} ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;cntSql=`SELECT COUNT(*) AS total FROM ST_Bookings ${stW}`;allP=stP;}
    else if(isOther){rowsSql=`${coSel} ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;cntSql=`SELECT COUNT(*) AS total FROM CustomerOverview ${coW}`;allP=coP;}
    else{allP={...coP,...stP};rowsSql=`SELECT * FROM (${coSel} UNION ALL ${stSel}) AS t ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;cntSql=`SELECT ((SELECT COUNT(*) FROM CustomerOverview ${coW})+(SELECT COUNT(*) FROM ST_Bookings ${stW})) AS total`;}

    const[rows,cnt]=await Promise.all([query(rowsSql,allP),query(cntSql,allP)]);
    res.json({rows:rows.recordset||[],total:cnt.recordset[0]?.total||0,page,limit});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────
router.get('/export', async (req,res)=>{
  try {
    const {coWhere,coP,stWhere,stP}=buildOverviewWhere(req.query);
    const co=`SELECT BookingID,Dataset,CASE WHEN Status='DEF' THEN 'ok' ELSE 'cancelled' END AS Status,CONVERT(VARCHAR(10),BookingDate,105) AS [Booking Date],CONVERT(VARCHAR(10),DepartureDate,105) AS [Departure Date],CONVERT(VARCHAR(10),ReturnDate,105) AS [Return Date],DATEDIFF(day,DepartureDate,ReturnDate) AS Duration,PAXCount AS PAX,ROUND(TotalRevenue,2) AS Revenue,TransportType AS Transport,BusType AS [Bus Class],DestinationResort AS Destination,Region,CustomerCountry AS Country,CAST(DepartureYear AS VARCHAR) AS Year FROM CustomerOverview ${coWhere}`;
    const st=`SELECT CAST(travelFileId AS VARCHAR) AS BookingID,'Snowtravel' AS Dataset,status AS Status,CONVERT(VARCHAR(10),creationTime,105) AS [Booking Date],CONVERT(VARCHAR(10),dateDeparture,105) AS [Departure Date],CONVERT(VARCHAR(10),dateReturn,105) AS [Return Date],DATEDIFF(day,dateDeparture,dateReturn) AS Duration,paxCount AS PAX,ROUND(totalPrice,2) AS Revenue,wayOfTransport AS Transport,busType AS [Bus Class],residence AS Destination,NULL AS Region,customerCountry AS Country,CAST(YEAR(dateDeparture) AS VARCHAR) AS Year FROM ST_Bookings ${stWhere}`;
    const r=await query(`SELECT TOP 100000 * FROM (${co} UNION ALL ${st}) AS t ORDER BY [Departure Date] DESC`,{...coP,...stP});
    const rows=r.recordset||[];
    if(!rows.length)return res.status(200).send('No data');
    const cols=Object.keys(rows[0]);
    const csv=[cols.join(','),...rows.map(row=>cols.map(c=>{const v=String(row[c]??'');return v.includes(',')||v.includes('"')?`"${v.replace(/"/g,'""')}"`:v;}).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment;filename=ttp-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\ufeff'+csv);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── EXPORT EXCEL ─────────────────────────────────────────────────────────────
router.get('/export-excel', async (req,res)=>{
  try {
    const {coWhere,coP,stWhere,stP}=buildOverviewWhere(req.query);
    const co=`SELECT BookingID,Dataset,CASE WHEN Status='DEF' THEN 'ok' ELSE 'cancelled' END AS Status,CONVERT(VARCHAR(10),BookingDate,105) AS [Booking Date],CONVERT(VARCHAR(10),DepartureDate,105) AS [Departure Date],CONVERT(VARCHAR(10),ReturnDate,105) AS [Return Date],DATEDIFF(day,DepartureDate,ReturnDate) AS Duration,PAXCount AS PAX,ROUND(TotalRevenue,2) AS Revenue,TransportType AS Transport,BusType AS [Bus Class],DestinationResort AS Destination,Region,CustomerCountry AS Country,CAST(DepartureYear AS VARCHAR) AS Year FROM CustomerOverview ${coWhere}`;
    const st=`SELECT CAST(travelFileId AS VARCHAR) AS BookingID,'Snowtravel' AS Dataset,status AS Status,CONVERT(VARCHAR(10),creationTime,105) AS [Booking Date],CONVERT(VARCHAR(10),dateDeparture,105) AS [Departure Date],CONVERT(VARCHAR(10),dateReturn,105) AS [Return Date],DATEDIFF(day,dateDeparture,dateReturn) AS Duration,paxCount AS PAX,ROUND(totalPrice,2) AS Revenue,wayOfTransport AS Transport,busType AS [Bus Class],residence AS Destination,NULL AS Region,customerCountry AS Country,CAST(YEAR(dateDeparture) AS VARCHAR) AS Year FROM ST_Bookings ${stWhere}`;
    const r=await query(`SELECT TOP 100000 * FROM (${co} UNION ALL ${st}) AS t ORDER BY [Departure Date] DESC`,{...coP,...stP});
    const rows=r.recordset||[];
    if(!rows.length)return res.status(200).json({error:'No data'});
    const cols=Object.keys(rows[0]);
    const xmlRows=rows.map(row=>`<Row>${cols.map(c=>{const v=row[c]??'';const isNum=typeof v==='number';return `<Cell><Data ss:Type="${isNum?'Number':'String'}">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`;}).join('')}</Row>`).join('');
    const hdrRow=`<Row>${cols.map(c=>`<Cell ss:StyleID="h"><Data ss:Type="String">${c}</Data></Cell>`).join('')}</Row>`;
    const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style></Styles><Worksheet ss:Name="TTP Export"><Table>${hdrRow}${xmlRows}</Table></Worksheet></Workbook>`;
    res.setHeader('Content-Type','application/vnd.ms-excel;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment;filename=ttp-export-${new Date().toISOString().split('T')[0]}.xls`);
    res.send(xml);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── HOTEL RATINGS ────────────────────────────────────────────────────────────
router.get('/hotel-ratings', async (req,res)=>{
  try {
    const r=await query(`SELECT accommodation_code,accommodation_name,external_code,avg_overall,avg_sleep,avg_location,avg_cleanliness,avg_service,avg_facilities,total_reviews,recommendation_pct,snapshot_date FROM HotelRatings WHERE snapshot_date=(SELECT MAX(snapshot_date) FROM HotelRatings) ORDER BY avg_overall DESC,total_reviews DESC`);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── HOTEL REVIEWS ────────────────────────────────────────────────────────────
router.get('/hotel-reviews', async (req,res)=>{
  try {
    const page=Math.max(1,parseInt(req.query.page)||1);
    const limit=Math.min(50,parseInt(req.query.limit)||20);
    const off=(page-1)*limit;
    const conds=[],p={};
    if(req.query.code){conds.push('accommodation_code=@code');p.code=req.query.code;}
    if(req.query.country){conds.push('reviewer_country=@country');p.country=req.query.country;}
    if(req.query.minRating){conds.push('overall_rating>=@min');p.min=parseFloat(req.query.minRating);}
    const where=conds.length?'WHERE '+conds.join(' AND '):'';
    const[rows,cnt]=await Promise.all([
      query(`SELECT id,accommodation_code,accommodation_name,review_date,overall_rating,category_sleep,category_location,category_cleanliness,category_service,category_facilities,review_title,review_text,reviewer_name,reviewer_city,reviewer_country,reviewer_age,travel_type,language FROM HotelReviews ${where} ORDER BY review_date DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`,p),
      query(`SELECT COUNT(*) AS total FROM HotelReviews ${where}`,p)
    ]);
    res.json({rows:rows.recordset||[],total:cnt.recordset[0]?.total||0,page,limit});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── HOTEL STATS ──────────────────────────────────────────────────────────────
router.get('/hotel-stats', async (req,res)=>{
  try {
    const r=await query(`SELECT COUNT(DISTINCT accommodation_code) AS total_hotels,COUNT(*) AS total_reviews,ROUND(AVG(CAST(overall_rating AS FLOAT)),2) AS avg_rating,COUNT(CASE WHEN overall_rating>=8 THEN 1 END) AS high_rated,COUNT(CASE WHEN overall_rating<6 THEN 1 END) AS low_rated,MAX(review_date) AS latest_review FROM HotelReviews`);
    res.json(r.recordset[0]||{});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── MARGIN OVERVIEW (Purchase Obligations) ────────────────
router.get('/margin-overview', async (req, res) => {
  try {
    const conds = [], p = {};
    if (req.query.departureFrom) { conds.push('CAST(DepartureDate AS DATE)>=@depFrom'); p.depFrom = req.query.departureFrom; }
    if (req.query.departureTo)   { conds.push('CAST(DepartureDate AS DATE)<=@depTo');   p.depTo   = req.query.departureTo; }
    if (req.query.returnFrom)    { conds.push('CAST(ReturnDate AS DATE)>=@retFrom');     p.retFrom = req.query.returnFrom; }
    if (req.query.returnTo)      { conds.push('CAST(ReturnDate AS DATE)<=@retTo');       p.retTo   = req.query.returnTo; }
    // NOTE: BookingDate does not exist in solmar.MarginOverview — booking date filters removed
    if (req.query.status && req.query.status !== 'all') {
      conds.push("StatusCode=@status"); p.status = req.query.status;
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const [kpiRes, rowsRes] = await Promise.all([
      query(`SELECT
        COUNT(*)                          AS totalBookings,
        ISNULL(ROUND(SUM(SalesBooking),2),0)          AS totalSales,
        ISNULL(ROUND(SUM(PurchaseCalculation),2),0)   AS totalPurchase,
        ISNULL(ROUND(SUM(PurchaseObligation),2),0)    AS totalObligation,
        ISNULL(ROUND(SUM(Margin),2),0)                AS totalMargin,
        COUNT(CASE WHEN StatusCode='ok' THEN 1 END)         AS confirmedCount,
        COUNT(CASE WHEN StatusCode='cancelled' THEN 1 END)  AS cancelledCount
        FROM solmar.MarginOverview ${where}`, p),
      query(`SELECT
        StatusCode,
        CONVERT(VARCHAR(10),DepartureDate,103) AS DepartureDate,
        CONVERT(VARCHAR(10),ReturnDate,103)    AS ReturnDate,
        PAX,
        ROUND(SalesBooking,2)              AS SalesBooking,
        ROUND(PurchaseCalculation,2)       AS PurchaseCalculation,
        ROUND(PurchaseObligation,2)        AS PurchaseObligation,
        ROUND(Margin,2)                    AS Margin,
        ROUND(Commission,2)                AS Commission,
        ROUND(MarginIncludingCommission,2) AS MarginIncludingCommission
        FROM solmar.MarginOverview ${where}
        ORDER BY DepartureDate DESC`, p),
    ]);

    res.json({
      kpis: kpiRes.recordset[0] || {},
      data: rowsRes.recordset || [],
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── MARGIN SLICERS ───────────────────────────────────────────────────────────────
router.get('/margin-slicers', async (req, res) => {
  try {
    const r = await query(`SELECT
      MIN(CAST(DepartureDate AS DATE)) AS minDeparture,
      MAX(CAST(DepartureDate AS DATE)) AS maxDeparture,
      MIN(CAST(ReturnDate AS DATE))    AS minReturn,
      MAX(CAST(ReturnDate AS DATE))    AS maxReturn
      FROM solmar.MarginOverview`);
    res.json(r.recordset[0] || {});
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ─── USER MANAGEMENT (Settings) ───────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname2,'../../data/users.json');
const readUsers = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch { return []; } };
const writeUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u,null,2));

router.get('/users', (req,res) => {
  try {
    const users = readUsers().map(u=>({id:u.id,username:u.username,role:u.role||'viewer'}));
    res.json(users);
  } catch(e){ res.status(500).json({error:e.message}); }
});

router.post('/users', async (req,res) => {
  try {
    const {username,password,role='viewer'} = req.body||{};
    if(!username||!password) return res.status(400).json({error:'username and password required'});
    const users = readUsers();
    if(users.find(u=>u.username===username)) return res.status(409).json({error:'User already exists'});
    const hash = await bcrypt.hash(password,10);
    const newUser = {id:Date.now().toString(),username,password:hash,role};
    users.push(newUser);
    writeUsers(users);
    res.json({id:newUser.id,username,role});
  } catch(e){ res.status(500).json({error:e.message}); }
});

router.put('/users/:id', async (req,res) => {
  try {
    const users = readUsers();
    const idx = users.findIndex(u=>u.id===req.params.id);
    if(idx<0) return res.status(404).json({error:'User not found'});
    const {role,password} = req.body||{};
    if(role) users[idx].role=role;
    if(password) users[idx].password=await bcrypt.hash(password,10);
    writeUsers(users);
    res.json({id:users[idx].id,username:users[idx].username,role:users[idx].role});
  } catch(e){ res.status(500).json({error:e.message}); }
});

router.delete('/users/:id', (req,res) => {
  try {
    let users = readUsers();
    const orig = users.length;
    users = users.filter(u=>u.id!==req.params.id);
    if(users.length===orig) return res.status(404).json({error:'User not found'});
    writeUsers(users);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ─── SETTINGS STORE (AI prompts, email alerts) ────────────────────────────────
const SETTINGS_FILE = path.join(__dirname2,'../../data/settings.json');
const readSettings = () => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8')); } catch { return {}; } };
const writeSettings = (s) => fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s,null,2));

router.get('/settings', (req,res) => {
  try { res.json(readSettings()); }
  catch(e){ res.status(500).json({error:e.message}); }
});

router.post('/settings', (req,res) => {
  try {
    const current = readSettings();
    const updated = {...current,...(req.body||{})};
    writeSettings(updated);
    res.json(updated);
  } catch(e){ res.status(500).json({error:e.message}); }
});

export default router;
