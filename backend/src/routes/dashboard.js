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
const CO_CONFIRMED = 'DEF';
const CO_CANCELLED = 'DEF-GEANNULEERD';
const ST_CONFIRMED = 'ok';
const ST_CANCELLED = 'cancelled';
const CO_ALL = `Status IN ('${CO_CONFIRMED}','${CO_CANCELLED}')`;
const CO_CONF = `Status='${CO_CONFIRMED}'`;
const ST_ALL = `status IN ('${ST_CONFIRMED}','${ST_CANCELLED}')`;
const ST_CONF = `status='${ST_CONFIRMED}'`;
const BUS_STATUS_CODES = ['DEF','TIJD','VERV','DEF-GEANNULEERD','ACC AV NIET OK','CTRL','IN_AANVRAAG'];
const BUS_STATUS_LABELS = {
  DEF: 'Confirmed',
  TIJD: 'Timed',
  VERV: 'Replaced',
  'DEF-GEANNULEERD': 'Cancelled',
  'ACC AV NIET OK': 'Accommodation Not OK',
  CTRL: 'Control',
  IN_AANVRAAG: 'Requested',
};

function arr(v){ return [].concat(v||[]).filter(Boolean); }
function numArr(v){ return arr(v).map(Number).filter(Number.isFinite); }
function uniq(v){ return [...new Set(v)]; }

function dateShiftOneYear(isoDate){
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const year = Number(isoDate.slice(0,4)) - 1;
  return `${year}${isoDate.slice(4)}`;
}

function parseFilters(q){
  return {
    dataset: uniq(arr(q.dataset)),
    status: uniq(arr(q.status)),
    year: uniq(numArr(q.year)),
    bookingDateFrom: q.bookingDateFrom || '',
    bookingDateTo: q.bookingDateTo || '',
    departureDateFrom: q.departureDateFrom || '',
    departureDateTo: q.departureDateTo || '',
    dateFrom: q.dateFrom || '',
    dateTo: q.dateTo || '',
    region: q.region || '',
    pendel: q.pendel || '',
    weekday: q.weekday || '',
    feederLine: q.feederLine || '',
    label: q.label || q.datasetName || '',
    direction: q.direction || '',
    statusBus: q.status || '',
    departureFrom: q.departureFrom || '',
    departureTo: q.departureTo || '',
    returnFrom: q.returnFrom || '',
    returnTo: q.returnTo || '',
    marginStatus: q.status || '',
  };
}

function cleanUnion(parts){
  const valid = parts.filter(Boolean);
  if (!valid.length) return `SELECT CAST(NULL AS INT) AS yr, CAST(NULL AS INT) AS mo, CAST(NULL AS INT) AS bookings, CAST(NULL AS BIGINT) AS pax, CAST(NULL AS DECIMAL(18,2)) AS revenue WHERE 1=0`;
  return valid.join(' UNION ALL ');
}

function buildOverviewWhere(filters, opts={}){
  const f = parseFilters(filters || {});
  const {
    yearsOverride = null,
    shiftYear = false,
    applyYearFilter = true,
    alias = '',
  } = opts;
  const pfx = alias ? `${alias}_` : '';
  const coC = [`Status IN ('${CO_CONFIRMED}','${CO_CANCELLED}')`], coP = {};
  const stC = [`status IN ('${ST_CONFIRMED}','${ST_CANCELLED}')`], stP = {};

  const depFrom = shiftYear ? dateShiftOneYear(f.departureDateFrom) : f.departureDateFrom;
  const depTo = shiftYear ? dateShiftOneYear(f.departureDateTo) : f.departureDateTo;
  const bkFrom = shiftYear ? dateShiftOneYear(f.bookingDateFrom) : f.bookingDateFrom;
  const bkTo = shiftYear ? dateShiftOneYear(f.bookingDateTo) : f.bookingDateTo;

  if (depFrom) { coC.push(`CAST(DepartureDate AS DATE)>=@${pfx}codf`); coP[`${pfx}codf`]=depFrom; stC.push(`CAST(dateDeparture AS DATE)>=@${pfx}stdf`); stP[`${pfx}stdf`]=depFrom; }
  if (depTo) { coC.push(`CAST(DepartureDate AS DATE)<=@${pfx}codt`); coP[`${pfx}codt`]=depTo; stC.push(`CAST(dateDeparture AS DATE)<=@${pfx}stdt`); stP[`${pfx}stdt`]=depTo; }
  if (bkFrom) { coC.push(`CAST(BookingDate AS DATE)>=@${pfx}cobf`); coP[`${pfx}cobf`]=bkFrom; stC.push(`CAST(creationTime AS DATE)>=@${pfx}stbf`); stP[`${pfx}stbf`]=bkFrom; }
  if (bkTo) { coC.push(`CAST(BookingDate AS DATE)<=@${pfx}cobt`); coP[`${pfx}cobt`]=bkTo; stC.push(`CAST(creationTime AS DATE)<=@${pfx}stbt`); stP[`${pfx}stbt`]=bkTo; }

  const ds = f.dataset;
  const coDatasets = ds.filter(d=>['Solmar','Interbus','Solmar DE'].includes(d));
  const includeCO = !ds.length || coDatasets.length>0;
  const includeST = !ds.length || ds.includes('Snowtravel');
  if (coDatasets.length){
    coDatasets.forEach((d,i)=>{ coP[`${pfx}cods${i}`]=d; });
    coC.push(`(${coDatasets.map((_,i)=>`Dataset=@${pfx}cods${i}`).join(' OR ')})`);
  }

  const st = f.status;
  const wantsConfirmed = st.some(s=>['ok','DEF','confirmed'].includes(s));
  const wantsCancelled = st.some(s=>['cancelled','DEF-GEANNULEERD'].includes(s));
  if (st.length){
    if (wantsConfirmed && !wantsCancelled){ coC.push(`Status='${CO_CONFIRMED}'`); stC.push(`status='${ST_CONFIRMED}'`); }
    else if (wantsCancelled && !wantsConfirmed){ coC.push(`Status='${CO_CANCELLED}'`); stC.push(`status='${ST_CANCELLED}'`); }
  }

  const years = yearsOverride || f.year;
  if (applyYearFilter && years.length){
    years.forEach((y,i)=>{ coP[`${pfx}coyr${i}`]=y; stP[`${pfx}styr${i}`]=y; });
    coC.push(`(${years.map((_,i)=>`DepartureYear=@${pfx}coyr${i}`).join(' OR ')})`);
    stC.push(`(${years.map((_,i)=>`YEAR(dateDeparture)=@${pfx}styr${i}`).join(' OR ')})`);
  }

  return {
    coWhere: `WHERE ${coC.join(' AND ')}`,
    stWhere: `WHERE ${stC.join(' AND ')}`,
    coP: coP,
    stP: stP,
    coParams: coP,
    stParams: stP,
    hasSolmar: includeCO,
    hasSnow: includeST,
    includeCO,
    includeST,
  };
}

function overviewUnionSql(whereObj){
  const coSql = whereObj.includeCO ? `
    SELECT
      DepartureYear AS yr,
      DepartureMonth AS mo,
      COUNT(*) AS bookings,
      SUM(PAXCount) AS pax,
      SUM(TotalRevenue) AS revenue
    FROM CustomerOverview
    ${whereObj.coWhere}
    GROUP BY DepartureYear, DepartureMonth
  ` : '';
  const stSql = whereObj.includeST ? `
    SELECT
      YEAR(dateDeparture) AS yr,
      MONTH(dateDeparture) AS mo,
      COUNT(*) AS bookings,
      SUM(paxCount) AS pax,
      SUM(totalPrice) AS revenue
    FROM ST_Bookings
    ${whereObj.stWhere}
    GROUP BY YEAR(dateDeparture), MONTH(dateDeparture)
  ` : '';
  return cleanUnion([coSql, stSql]);
}

// ─── SLICERS ──────────────────────────────────────────────────────────────────
router.get('/slicers', async (req,res)=>{
  try {
    const [datasets, years, statuses] = await Promise.all([
      query(`
        SELECT DISTINCT Dataset AS val
        FROM CustomerOverview
        WHERE Dataset IN ('Solmar','Interbus','Solmar DE')
        UNION
        SELECT 'Snowtravel' AS val
      `),
      query(`
        SELECT DISTINCT DepartureYear AS yr
        FROM CustomerOverview
        WHERE DepartureYear IS NOT NULL
        UNION
        SELECT DISTINCT YEAR(dateDeparture) AS yr
        FROM ST_Bookings
        WHERE dateDeparture IS NOT NULL
      `),
      query(`SELECT 'ok' AS status UNION SELECT 'cancelled' AS status`),
    ]);
    res.json({
      datasets: (datasets.recordset||[]).map(r=>r.val),
      years: (years.recordset||[]).map(r=>r.yr).filter(Boolean).sort((a,b)=>a-b),
      statuses: (statuses.recordset||[]).map(r=>r.status),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── KPIs ─────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req,res)=>{
  try {
    const f = parseFilters(req.query);
    const hasDateRange = !!(f.departureDateFrom || f.departureDateTo || f.bookingDateFrom || f.bookingDateTo);

    const curYear = new Date().getFullYear();
    const currentYears = f.year.length ? f.year : [curYear];
    const previousYears = currentYears.map(y=>y-1);

    const currentWhere = buildOverviewWhere(f, {
      yearsOverride: hasDateRange ? [] : currentYears,
      applyYearFilter: !hasDateRange,
      alias: 'cur',
    });
    const previousWhere = buildOverviewWhere(f, {
      yearsOverride: hasDateRange ? [] : previousYears,
      applyYearFilter: !hasDateRange,
      shiftYear: hasDateRange,
      alias: 'prv',
    });

    const currentSql = overviewUnionSql(currentWhere);
    const previousSql = overviewUnionSql(previousWhere);
    const params = {...currentWhere.coParams,...currentWhere.stParams,...previousWhere.coParams,...previousWhere.stParams};

    const sql = `
      WITH cur AS (
        SELECT SUM(bookings) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM (${currentSql}) x
      ),
      prv AS (
        SELECT SUM(bookings) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM (${previousSql}) y
      )
      SELECT
        ISNULL(cur.bookings,0) AS currentBookings,
        ISNULL(prv.bookings,0) AS previousBookings,
        ISNULL(cur.pax,0) AS currentPax,
        ISNULL(prv.pax,0) AS previousPax,
        ISNULL(ROUND(cur.revenue,2),0) AS currentRevenue,
        ISNULL(ROUND(prv.revenue,2),0) AS previousRevenue
      FROM cur CROSS JOIN prv
    `;
    const r = (await query(sql, params)).recordset[0] || {};
    const cb = Number(r.currentBookings||0), pb = Number(r.previousBookings||0);
    const cp = Number(r.currentPax||0), pp = Number(r.previousPax||0);
    const cr = Number(r.currentRevenue||0), pr = Number(r.previousRevenue||0);

    res.json({
      currentBookings: cb,
      previousBookings: pb,
      differenceBookings: cb-pb,
      percentBookings: pb>0 ? ((cb-pb)/pb)*100 : null,
      currentPax: cp,
      previousPax: pp,
      differencePax: cp-pp,
      percentPax: pp>0 ? ((cp-pp)/pp)*100 : null,
      currentRevenue: cr,
      previousRevenue: pr,
      differenceRevenue: cr-pr,
      percentRevenue: pr>0 ? ((cr-pr)/pr)*100 : null,
      periodLabel: hasDateRange ? `${f.departureDateFrom || f.bookingDateFrom || ''}${(f.departureDateTo || f.bookingDateTo) ? ` – ${f.departureDateTo || f.bookingDateTo}` : ''}` : currentYears.join(', '),
      prevLabel: hasDateRange ? `${dateShiftOneYear(f.departureDateFrom || f.bookingDateFrom || '')}${(f.departureDateTo || f.bookingDateTo) ? ` – ${dateShiftOneYear(f.departureDateTo || f.bookingDateTo)}` : ''}` : previousYears.join(', '),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── REVENUE BY YEAR ──────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req,res)=>{
  try {
    const f = parseFilters(req.query);
    const whereObj = buildOverviewWhere(f, { alias: 'ry' });
    const unionSql = overviewUnionSql(whereObj);
    const p = {...whereObj.coParams,...whereObj.stParams};
    const r = await query(`
      SELECT
        yr AS year,
        mo AS month,
        SUM(bookings) AS bookings,
        SUM(pax) AS pax,
        ROUND(SUM(revenue),2) AS revenue
      FROM (${unionSql}) t
      GROUP BY yr, mo
      ORDER BY (yr*100+mo) ASC
    `, p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── YEAR-MONTH COMPARISON ────────────────────────────────────────────────────
router.get('/year-month-comparison', async (req,res)=>{
  try {
    const f = parseFilters(req.query);
    const hasDateRange = !!(f.departureDateFrom || f.departureDateTo || f.bookingDateFrom || f.bookingDateTo);

    const curYear = new Date().getFullYear();
    const selectedYears = f.year.length ? f.year : [curYear];
    const loadYears = uniq([...selectedYears, ...selectedYears.map(y=>y-1)]);

    const currentWhere = buildOverviewWhere(f, {
      yearsOverride: hasDateRange ? [] : loadYears,
      applyYearFilter: !hasDateRange,
      alias: 'ymc',
    });
    const previousWhere = hasDateRange ? buildOverviewWhere(f, {
      yearsOverride: [],
      applyYearFilter: false,
      shiftYear: true,
      alias: 'ymp',
    }) : null;

    const currentUnion = overviewUnionSql(currentWhere);
    const previousUnion = previousWhere ? overviewUnionSql(previousWhere) : '';
    const p = {
      ...currentWhere.coParams,
      ...currentWhere.stParams,
      ...(previousWhere ? previousWhere.coParams : {}),
      ...(previousWhere ? previousWhere.stParams : {}),
    };

    const sql = hasDateRange ? `
      WITH cur AS (
        SELECT yr, mo, SUM(bookings) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM (${currentUnion}) a
        GROUP BY yr, mo
      ),
      prv AS (
        SELECT yr, mo, SUM(bookings) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM (${previousUnion}) b
        GROUP BY yr, mo
      )
      SELECT
        cur.yr AS currentYear,
        cur.yr-1 AS previousYear,
        cur.mo AS month,
        cur.bookings AS currentBookings,
        ISNULL(prv.bookings,0) AS previousBookings,
        cur.pax AS currentPax,
        ISNULL(prv.pax,0) AS previousPax,
        ROUND(cur.revenue,2) AS currentRevenue,
        ROUND(ISNULL(prv.revenue,0),2) AS previousRevenue,
        cur.bookings-ISNULL(prv.bookings,0) AS diffBookings,
        cur.pax-ISNULL(prv.pax,0) AS diffPax,
        ROUND(cur.revenue-ISNULL(prv.revenue,0),2) AS diffRevenue,
        CASE WHEN ISNULL(prv.bookings,0)>0 THEN ROUND((CAST(cur.bookings AS FLOAT)-prv.bookings)/prv.bookings*100,1) ELSE NULL END AS diffPctBookings,
        CASE WHEN ISNULL(prv.pax,0)>0 THEN ROUND((CAST(cur.pax AS FLOAT)-prv.pax)/prv.pax*100,1) ELSE NULL END AS diffPctPax,
        CASE WHEN ISNULL(prv.revenue,0)>0 THEN ROUND((cur.revenue-prv.revenue)/prv.revenue*100,1) ELSE NULL END AS diffPctRevenue
      FROM cur
      LEFT JOIN prv ON prv.mo=cur.mo AND prv.yr=cur.yr-1
      ORDER BY (cur.yr*100+cur.mo) DESC
    ` : `
      WITH base AS (
        SELECT yr, mo, SUM(bookings) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM (${currentUnion}) z
        GROUP BY yr, mo
      )
      SELECT
        a.yr AS currentYear,
        a.yr-1 AS previousYear,
        a.mo AS month,
        a.bookings AS currentBookings,
        ISNULL(b.bookings,0) AS previousBookings,
        a.pax AS currentPax,
        ISNULL(b.pax,0) AS previousPax,
        ROUND(a.revenue,2) AS currentRevenue,
        ROUND(ISNULL(b.revenue,0),2) AS previousRevenue,
        a.bookings-ISNULL(b.bookings,0) AS diffBookings,
        a.pax-ISNULL(b.pax,0) AS diffPax,
        ROUND(a.revenue-ISNULL(b.revenue,0),2) AS diffRevenue,
        CASE WHEN ISNULL(b.bookings,0)>0 THEN ROUND((CAST(a.bookings AS FLOAT)-b.bookings)/b.bookings*100,1) ELSE NULL END AS diffPctBookings,
        CASE WHEN ISNULL(b.pax,0)>0 THEN ROUND((CAST(a.pax AS FLOAT)-b.pax)/b.pax*100,1) ELSE NULL END AS diffPctPax,
        CASE WHEN ISNULL(b.revenue,0)>0 THEN ROUND((a.revenue-b.revenue)/b.revenue*100,1) ELSE NULL END AS diffPctRevenue
      FROM base a
      LEFT JOIN base b ON b.yr=a.yr-1 AND b.mo=a.mo
      ORDER BY (a.yr*100+a.mo) DESC
    `;

    const r = await query(sql, p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── BUS SLICERS ──────────────────────────────────────────────────────────────
router.get('/bus-slicers', async (req,res)=>{
  try {
    const [pendels,regions,statuses,feederLines]=await Promise.all([
      query(`SELECT DISTINCT Pendel_Outbound AS val FROM solmar_bus_deck_choice WHERE Pendel_Outbound IS NOT NULL AND LTRIM(RTRIM(Pendel_Outbound))!='' ORDER BY Pendel_Outbound`),
      query(`SELECT DISTINCT Region AS val FROM solmar_bus_deck_choice WHERE Region IS NOT NULL AND LTRIM(RTRIM(Region))!='' ORDER BY Region`),
      query(`SELECT DISTINCT Status AS val FROM solmar_bus_deck_choice WHERE Status IS NOT NULL AND LTRIM(RTRIM(Status))!='' ORDER BY Status`),
      query(`SELECT DISTINCT FeederLine AS val FROM FeederOverview WHERE FeederLine IS NOT NULL AND LTRIM(RTRIM(FeederLine))!='' ORDER BY FeederLine`),
    ]);
    const statusList = (statuses.recordset||[]).map(r=>r.val).filter(Boolean);
    res.json({
      pendels:(pendels.recordset||[]).map(r=>r.val),
      regions:(regions.recordset||[]).map(r=>r.val),
      statuses:statusList,
      statusesEnglish:statusList.map(code=>({ code, label: BUS_STATUS_LABELS[code] || code })),
      feederLines:(feederLines.recordset||[]).map(r=>r.val),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

function buildBusWhere(q){
  const f = parseFilters(q);
  const conds = [], params = {};
  if (f.dateFrom) { conds.push('CAST(dateDeparture AS DATE)>=@df'); params.df=f.dateFrom; }
  if (f.dateTo) { conds.push('CAST(dateDeparture AS DATE)<=@dt'); params.dt=f.dateTo; }
  if (f.region) { conds.push('Region=@rg'); params.rg=f.region; }
  if (f.pendel) { conds.push('Pendel_Outbound LIKE @pd'); params.pd=`%${f.pendel}%`; }
  if (f.weekday) { conds.push('DATENAME(weekday,dateDeparture)=@wd'); params.wd=f.weekday; }
  if (f.statusBus && f.statusBus !== 'all') { conds.push('Status=@st'); params.st=f.statusBus; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return { where, params };
}

function buildDeckWhere(q){
  return buildBusWhere(q);
}

function buildFeederWhere(q){
  const f = parseFilters(q);
  const conds = [], params = {};
  if (f.dateFrom) { conds.push('CAST(DepartureDate AS DATE)>=@df'); params.df=f.dateFrom; }
  if (f.dateTo) { conds.push('CAST(DepartureDate AS DATE)<=@dt'); params.dt=f.dateTo; }
  if (f.feederLine) { conds.push('FeederLine=@fl'); params.fl=f.feederLine; }
  if (f.label) { conds.push('LabelName=@lb'); params.lb=f.label; }
  if (f.direction) { conds.push('Direction=@dr'); params.dr=f.direction; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return { where, params };
}

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
      FROM solmar_bus_deck_choice ${where}`,params);
    res.json(r.recordset[0]||{});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── PENDEL OVERVIEW ──────────────────────────────────────────────────────────
router.get('/pendel-overview', async (req,res)=>{
  try {
    const f = parseFilters(req.query);
    const conds=[], params={};
    if (f.dateFrom) { conds.push('CAST(StartDate AS DATE)>=@df'); params.df=f.dateFrom; }
    if (f.dateTo) { conds.push('CAST(StartDate AS DATE)<=@dt'); params.dt=f.dateTo; }
    if (f.weekday) { conds.push('DATENAME(weekday,StartDate)=@wd'); params.wd=f.weekday; }
    const where=conds.length?`WHERE ${conds.join(' AND ')}`:'';
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
    const {where,params}=buildFeederWhere(req.query);
    const r=await query(`SELECT
      CONVERT(VARCHAR(10),DepartureDate,105) AS DepartureDate,
      LabelName,FeederLine,RouteNo,RouteLabel,StopName,StopType,Direction,
      SUM(TotalPax) AS TotalPax,SUM(BookingCount) AS BookingCount
      FROM FeederOverview ${where}
      GROUP BY DepartureDate,LabelName,FeederLine,RouteNo,RouteLabel,StopName,StopType,Direction
      ORDER BY RouteNo ASC,StopName ASC,CAST(DepartureDate AS DATE) ASC`,params);
    const rows = r.recordset || [];
    const totalsMap = new Map();
    for (const row of rows){
      const key = [row.DepartureDate,row.LabelName,row.FeederLine,row.RouteNo,row.RouteLabel,row.Direction||''].join('||');
      if (!totalsMap.has(key)){
        totalsMap.set(key,{
          DepartureDate: row.DepartureDate,
          LabelName: row.LabelName,
          FeederLine: row.FeederLine,
          RouteNo: row.RouteNo,
          RouteLabel: row.RouteLabel,
          StopName: 'Totaal vertrek',
          StopType: 'TOTAL',
          Direction: row.Direction || null,
          TotalPax: 0,
          BookingCount: 0,
        });
      }
      const t = totalsMap.get(key);
      t.TotalPax += Number(row.TotalPax||0);
      t.BookingCount += Number(row.BookingCount||0);
    }
    const totals = [...totalsMap.values()];
    res.json([...totals, ...rows]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/feeder-slicers', async (req,res)=>{
  try {
    const [labels, feederLines, routes, directions] = await Promise.all([
      query(`SELECT DISTINCT LabelName AS val FROM FeederOverview WHERE LabelName IS NOT NULL AND LTRIM(RTRIM(LabelName))!='' ORDER BY LabelName`),
      query(`SELECT DISTINCT FeederLine AS val FROM FeederOverview WHERE FeederLine IS NOT NULL AND LTRIM(RTRIM(FeederLine))!='' ORDER BY FeederLine`),
      query(`SELECT DISTINCT RouteNo AS val FROM FeederOverview WHERE RouteNo IS NOT NULL ORDER BY RouteNo`),
      query(`SELECT DISTINCT Direction AS val FROM FeederOverview WHERE Direction IS NOT NULL AND LTRIM(RTRIM(Direction))!='' ORDER BY Direction`),
    ]);
    res.json({
      labels: (labels.recordset||[]).map(r=>r.val),
      feederLines: (feederLines.recordset||[]).map(r=>r.val),
      routeNos: (routes.recordset||[]).map(r=>r.val),
      directions: (directions.recordset||[]).map(r=>r.val),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── DECK CLASS ───────────────────────────────────────────────────────────────
router.get('/deck-class', async (req,res)=>{
  try {
    const {where, params} = buildDeckWhere(req.query);
    const r=await query(`SELECT
      CONVERT(VARCHAR(10),dateDeparture,103) AS dateDeparture,
      SUM(PAX) AS Total,
      SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' THEN PAX ELSE 0 END) AS Total_Lower,
      SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' THEN PAX ELSE 0 END) AS Total_Upper,
      SUM(CASE WHEN Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL THEN PAX ELSE 0 END) AS Total_NoDeck,
      SUM(CASE WHEN Outbound_Class='Royal Class' THEN PAX ELSE 0 END) AS Royal_Total,
      SUM(CASE WHEN Outbound_Class='Royal Class' AND Outbound_Deck LIKE '%Onderdek%' THEN PAX ELSE 0 END) AS Royal_Lower,
      SUM(CASE WHEN Outbound_Class='Royal Class' AND Outbound_Deck LIKE '%Bovendek%' THEN PAX ELSE 0 END) AS Royal_Upper,
      SUM(CASE WHEN Outbound_Class='Royal Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Royal_NoDeck,
      SUM(CASE WHEN Outbound_Class='First Class' THEN PAX ELSE 0 END) AS First_Total,
      SUM(CASE WHEN Outbound_Class='First Class' AND Outbound_Deck LIKE '%Onderdek%' THEN PAX ELSE 0 END) AS First_Lower,
      SUM(CASE WHEN Outbound_Class='First Class' AND Outbound_Deck LIKE '%Bovendek%' THEN PAX ELSE 0 END) AS First_Upper,
      SUM(CASE WHEN Outbound_Class='First Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS First_NoDeck,
      SUM(CASE WHEN Outbound_Class='Premium Class' THEN PAX ELSE 0 END) AS Premium_Total,
      SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Onderdek%' THEN PAX ELSE 0 END) AS Premium_Lower,
      SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Bovendek%' THEN PAX ELSE 0 END) AS Premium_Upper,
      SUM(CASE WHEN Outbound_Class='Premium Class' AND (Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL) THEN PAX ELSE 0 END) AS Premium_NoDeck
      FROM solmar_bus_deck_choice ${where}
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
    const f = parseFilters(req.query);
    const conds = [`StatusCode IN ('ok','cancelled')`], p = {};
    if (f.departureFrom) { conds.push('CAST(DepartureDate AS DATE)>=@depFrom'); p.depFrom = f.departureFrom; }
    if (f.departureTo) { conds.push('CAST(DepartureDate AS DATE)<=@depTo'); p.depTo = f.departureTo; }
    if (f.returnFrom) { conds.push('CAST(ReturnDate AS DATE)>=@retFrom'); p.retFrom = f.returnFrom; }
    if (f.returnTo) { conds.push('CAST(ReturnDate AS DATE)<=@retTo'); p.retTo = f.returnTo; }
    if (f.marginStatus && f.marginStatus !== 'all') { conds.push('StatusCode=@status'); p.status = f.marginStatus; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const [kpiRes, rowsRes] = await Promise.all([
      query(`SELECT
        COUNT(*)                          AS totalBookings,
        ISNULL(ROUND(SUM(SalesBooking),2),0)          AS totalSales,
        ISNULL(ROUND(SUM(PurchaseCalculation),2),0)   AS totalPurchase,
        ISNULL(ROUND(SUM(PurchaseObligation),2),0)    AS totalObligation,
        ISNULL(ROUND(SUM(Margin),2),0)                AS totalMargin,
        ISNULL(ROUND(SUM(Commission),2),0)            AS totalCommission,
        ISNULL(ROUND(SUM(MarginIncludingCommission),2),0) AS totalMarginIncludingCommission,
        COUNT(CASE WHEN StatusCode='ok' THEN 1 END)         AS confirmedCount,
        COUNT(CASE WHEN StatusCode='cancelled' THEN 1 END)  AS cancelledCount
        FROM solmar.MarginOverview ${where}`, p),
      query(`SELECT
        BookingID,
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
        ORDER BY CAST(DepartureDate AS DATE) DESC`, p),
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
      MAX(CAST(ReturnDate AS DATE))    AS maxReturn,
      MIN(CAST(BookingDate AS DATE))   AS minBooking,
      MAX(CAST(BookingDate AS DATE))   AS maxBooking
      FROM solmar.MarginOverview
      WHERE StatusCode IN ('ok','cancelled')`);
    const [statuses, travelTypes] = await Promise.all([
      query(`SELECT DISTINCT StatusCode AS val FROM solmar.MarginOverview WHERE StatusCode IN ('ok','cancelled') ORDER BY StatusCode`),
      query(`SELECT DISTINCT TravelType AS val FROM solmar.MarginOverview WHERE TravelType IS NOT NULL AND LTRIM(RTRIM(TravelType))!='' ORDER BY TravelType`),
    ]);
    res.json({
      ...(r.recordset[0] || {}),
      statuses: (statuses.recordset||[]).map(x=>x.val),
      travelTypes: (travelTypes.recordset||[]).map(x=>x.val),
    });
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
