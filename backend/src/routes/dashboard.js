import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

// ─── WHERE BUILDER ────────────────────────────────────────────────────────────
function buildWhere(q) {
  const conds = [], p = {};
  if (q.departureDateFrom) { conds.push('departure_date >= @depFrom'); p.depFrom = q.departureDateFrom; }
  if (q.departureDateTo)   { conds.push('departure_date <= @depTo');   p.depTo   = q.departureDateTo;   }
  if (q.bookingDateFrom)   { conds.push('booking_date >= @bkFrom');    p.bkFrom  = q.bookingDateFrom;   }
  if (q.bookingDateTo)     { conds.push('booking_date <= @bkTo');      p.bkTo    = q.bookingDateTo;     }
  const ds = [].concat(q.dataset||[]).filter(Boolean);
  if (ds.length) { ds.forEach((d,i)=>{p[`ds${i}`]=d;}); conds.push(`(${ds.map((_,i)=>`dataset=@ds${i}`).join(' OR ')})`); }
  const st = [].concat(q.status||[]).filter(Boolean);
  if (st.length) { st.forEach((s,i)=>{p[`st${i}`]=s;}); conds.push(`(${st.map((_,i)=>`status=@st${i}`).join(' OR ')})`); }
  const yr = [].concat(q.year||[]).filter(Boolean).map(Number);
  if (yr.length) { yr.forEach((y,i)=>{p[`yr${i}`]=y;}); conds.push(`(${yr.map((_,i)=>`year=@yr${i}`).join(' OR ')})`); }
  const tr = [].concat(q.transportType||[]).filter(Boolean);
  if (tr.length) { tr.forEach((t,i)=>{p[`tr${i}`]=t;}); conds.push(`(${tr.map((_,i)=>`transport_type=@tr${i}`).join(' OR ')})`); }
  return { whereClause: conds.length ? 'WHERE '+conds.join(' AND ') : '', params: p };
}
const ws = w => w ? w+" AND status IN ('ok','cancelled')" : "WHERE status IN ('ok','cancelled')";

// ─── SLICERS ──────────────────────────────────────────────────────────────────
router.get('/slicers', async (req,res)=>{
  try {
    const r = await query(`SELECT DISTINCT LOWER(REPLACE(transport_type,'ownTransport','own transport')) AS t FROM bookings WHERE transport_type IS NOT NULL AND status IN ('ok','cancelled') ORDER BY t`);
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
    let sql,p,periodLabel,prevLabel;

    if (hasDate && !datasets.length && !years.length) {
      // Pure date range — show totals for that range only
      const {whereClause,params}=buildWhere(req.query);
      periodLabel='Selected range'; prevLabel='';
      sql=`SELECT SUM(revenue) AS cr,0 AS pr,SUM(pax) AS cp,0 AS pp,COUNT(*) AS cb,0 AS pb FROM bookings ${ws(whereClause)}`;
      p=params;
    } else if (years.length===1) {
      const yr=years[0];
      const {whereClause,params}=buildWhere({...req.query,year:undefined});
      periodLabel=`Year ${yr}`; prevLabel=`Year ${yr-1}`;
      sql=`SELECT SUM(CASE WHEN year=${yr} THEN revenue ELSE 0 END) AS cr,SUM(CASE WHEN year=${yr-1} THEN revenue ELSE 0 END) AS pr,SUM(CASE WHEN year=${yr} THEN pax ELSE 0 END) AS cp,SUM(CASE WHEN year=${yr-1} THEN pax ELSE 0 END) AS pp,COUNT(CASE WHEN year=${yr} THEN 1 END) AS cb,COUNT(CASE WHEN year=${yr-1} THEN 1 END) AS pb FROM bookings ${ws(whereClause)}`;
      p=params;
    } else if (datasets.length>0) {
      // Dataset filter — show ALL years for that dataset, compare curY vs prevY
      const {whereClause,params}=buildWhere({...req.query,year:undefined});
      periodLabel=datasets.join(' + ')+` — all years`; prevLabel=String(prevY);
      sql=`SELECT SUM(revenue) AS cr,SUM(CASE WHEN year=${prevY} THEN revenue ELSE 0 END) AS pr,SUM(pax) AS cp,SUM(CASE WHEN year=${prevY} THEN pax ELSE 0 END) AS pp,COUNT(*) AS cb,COUNT(CASE WHEN year=${prevY} THEN 1 END) AS pb FROM bookings ${ws(whereClause)}`;
      p=params;
    } else {
      // Default — current year vs previous year
      periodLabel=`${curY} vs ${prevY}`; prevLabel=String(prevY);
      sql=`SELECT SUM(CASE WHEN year=${curY} THEN revenue ELSE 0 END) AS cr,SUM(CASE WHEN year=${prevY} THEN revenue ELSE 0 END) AS pr,SUM(CASE WHEN year=${curY} THEN pax ELSE 0 END) AS cp,SUM(CASE WHEN year=${prevY} THEN pax ELSE 0 END) AS pp,COUNT(CASE WHEN year=${curY} THEN 1 END) AS cb,COUNT(CASE WHEN year=${prevY} THEN 1 END) AS pb FROM bookings WHERE status IN ('ok','cancelled')`;
      p={};
    }
    const r=(await query(sql,p)).recordset[0]||{};
    const cb=r.cb||0,pb=r.pb||0,cp=r.cp||0,pp=r.pp||0,cr=parseFloat(r.cr)||0,pr=parseFloat(r.pr)||0;
    res.json({currentBookings:cb,previousBookings:pb,differenceBookings:cb-pb,percentBookings:pb>0?(cb-pb)/pb*100:null,currentPax:cp,previousPax:pp,differencePax:cp-pp,percentPax:pp>0?(cp-pp)/pp*100:null,currentRevenue:cr,previousRevenue:pr,differenceRevenue:cr-pr,percentRevenue:pr>0?(cr-pr)/pr*100:null,periodLabel,prevLabel});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── REVENUE BY YEAR ──────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req,res)=>{
  try {
    const {whereClause,params}=buildWhere(req.query);
    const r=await query(`SELECT year,month,COUNT(*) AS bookings,SUM(pax) AS pax,ROUND(SUM(revenue),2) AS revenue FROM bookings ${ws(whereClause)} AND year BETWEEN 2023 AND 2027 GROUP BY year,month ORDER BY year ASC,month ASC`,params);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── YEAR-MONTH COMPARISON ────────────────────────────────────────────────────
router.get('/year-month-comparison', async (req,res)=>{
  try {
    const {whereClause,params}=buildWhere(req.query);
    const r=await query(`WITH base AS (SELECT year,month,COUNT(*) AS bookings,SUM(pax) AS pax,ROUND(SUM(revenue),2) AS revenue FROM bookings ${ws(whereClause)} AND year BETWEEN 2022 AND 2027 GROUP BY year,month) SELECT a.year,a.month,a.bookings AS currentBookings,ISNULL(b.bookings,0) AS previousBookings,a.pax AS currentPax,ISNULL(b.pax,0) AS previousPax,a.revenue AS currentRevenue,ISNULL(b.revenue,0) AS previousRevenue,a.bookings-ISNULL(b.bookings,0) AS diffBookings,a.pax-ISNULL(b.pax,0) AS diffPax,a.revenue-ISNULL(b.revenue,0) AS diffRevenue,CASE WHEN ISNULL(b.bookings,0)>0 THEN ROUND((CAST(a.bookings AS FLOAT)-b.bookings)/b.bookings*100,1) ELSE NULL END AS diffPctBookings,CASE WHEN ISNULL(b.pax,0)>0 THEN ROUND((CAST(a.pax AS FLOAT)-b.pax)/b.pax*100,1) ELSE NULL END AS diffPctPax,CASE WHEN ISNULL(b.revenue,0)>0 THEN ROUND((a.revenue-b.revenue)/b.revenue*100,1) ELSE NULL END AS diffPctRevenue FROM base a LEFT JOIN base b ON b.year=a.year-1 AND b.month=a.month ORDER BY a.year DESC,a.month DESC`,params);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── BUS CLASS SUMMARY ────────────────────────────────────────────────────────
router.get('/bus-class-summary', async (req,res)=>{
  try {
    const r=await query(`SELECT bus_type_name AS bus_class,dataset,COUNT(*) AS bookings,SUM(pax) AS pax,ROUND(SUM(revenue),2) AS revenue FROM bookings WHERE bus_type_name IS NOT NULL AND bus_type_name NOT IN ('Other','') AND status IN ('ok','cancelled') GROUP BY bus_type_name,dataset ORDER BY pax DESC`);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── PENDEL OVERVIEW ──────────────────────────────────────────────────────────
router.get('/pendel-overview', async (req,res)=>{
  try {
    const conds=[],p={};
    if(req.query.dateFrom){conds.push('dateDeparture>=@df');p.df=req.query.dateFrom;}
    if(req.query.dateTo){conds.push('dateDeparture<=@dt');p.dt=req.query.dateTo;}
    if(req.query.label){conds.push('Label=@lb');p.lb=req.query.label;}
    if(req.query.pendel&&req.query.pendel!=='Spain (All)'){conds.push('Pendel LIKE @pd');p.pd=`%${req.query.pendel}%`;}
    const where=conds.length?'WHERE '+conds.join(' AND '):'';
    const r=await query(`SELECT CONVERT(VARCHAR(10),dateDeparture,103) AS StartDate,CONVERT(VARCHAR(10),dateReturn,103) AS EndDate,SUM(Outbound_Total) AS Outbound_Total,SUM(Outbound_Royal) AS Outbound_Royal,SUM(Outbound_First) AS Outbound_First,SUM(Outbound_Premium) AS Outbound_Premium,SUM(Inbound_Total) AS Inbound_Total,SUM(Inbound_Royal) AS Inbound_Royal,SUM(Inbound_First) AS Inbound_First,SUM(Inbound_Premium) AS Inbound_Premium,SUM(Diff_Royal) AS Diff_Royal,SUM(Diff_First) AS Diff_First,SUM(Diff_Premium) AS Diff_Premium FROM VW_Solmar_Pendel_Overview ${where} GROUP BY dateDeparture,dateReturn ORDER BY dateDeparture DESC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── FEEDER OVERVIEW ──────────────────────────────────────────────────────────
router.get('/feeder-overview', async (req,res)=>{
  try {
    const conds=[],p={};
    if(req.query.dateFrom){conds.push('DepartureDate>=@df');p.df=req.query.dateFrom;}
    if(req.query.dateTo){conds.push('DepartureDate<=@dt');p.dt=req.query.dateTo;}
    if(req.query.direction){conds.push('Direction=@dir');p.dir=req.query.direction;}
    const labels=[].concat(req.query.label||[]).filter(Boolean);
    if(labels.length){labels.forEach((l,i)=>{p[`lb${i}`]=l;});conds.push(`(${labels.map((_,i)=>`LabelName=@lb${i}`).join(' OR ')})`);}
    const where=conds.length?'WHERE '+conds.join(' AND '):'';
    const r=await query(`SELECT CONVERT(VARCHAR(10),DepartureDate,103) AS DepartureDate,LabelName,FeederLine,Direction,RouteNo,RouteLabel,StopName,StopType,SUM(TotalPax) AS TotalPax,SUM(BookingCount) AS BookingCount FROM FeederOverview ${where} GROUP BY DepartureDate,LabelName,FeederLine,Direction,RouteNo,RouteLabel,StopName,StopType ORDER BY DepartureDate DESC,RouteNo ASC,StopName ASC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── DECK CLASS ───────────────────────────────────────────────────────────────
router.get('/deck-class', async (req,res)=>{
  try {
    const conds=[],p={};
    if(req.query.dateFrom){conds.push('dateDeparture>=@df');p.df=req.query.dateFrom;}
    if(req.query.dateTo){conds.push('dateDeparture<=@dt');p.dt=req.query.dateTo;}
    if(req.query.label){conds.push('Label=@lb');p.lb=req.query.label;}
    if(req.query.pendel&&req.query.pendel!=='Spain (All)'){conds.push('Pendel LIKE @pd');p.pd=`%${req.query.pendel}%`;}
    const where=conds.length?'WHERE '+conds.join(' AND '):'';
    const r=await query(`SELECT CONVERT(VARCHAR(10),dateDeparture,103) AS dateDeparture,CONVERT(VARCHAR(10),dateReturn,103) AS dateReturn,SUM(Total) AS Total,SUM(Total_Lower) AS Total_Lower,SUM(Total_Upper) AS Total_Upper,SUM(Total_NoDeck) AS Total_NoDeck,SUM(Royal_Total) AS Royal_Total,SUM(Royal_Lower) AS Royal_Lower,SUM(Royal_Upper) AS Royal_Upper,SUM(Royal_NoDeck) AS Royal_NoDeck,SUM(First_Total) AS First_Total,SUM(First_Lower) AS First_Lower,SUM(First_Upper) AS First_Upper,SUM(First_NoDeck) AS First_NoDeck,SUM(Premium_Total) AS Premium_Total,SUM(Premium_Lower) AS Premium_Lower,SUM(Premium_Upper) AS Premium_Upper,SUM(Premium_NoDeck) AS Premium_NoDeck FROM VW_Solmar_Deck_Class ${where} GROUP BY dateDeparture,dateReturn ORDER BY dateDeparture DESC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── BUSTRIPS ─────────────────────────────────────────────────────────────────
router.get('/bustrips', async (req,res)=>{
  try {
    const conds=[],p={};
    if(req.query.dateFrom){conds.push('StartDate>=@df');p.df=req.query.dateFrom;}
    if(req.query.dateTo){conds.push('EndDate<=@dt');p.dt=req.query.dateTo;}
    const where=conds.length?'WHERE '+conds.join(' AND '):'';
    const r=await query(`SELECT CONVERT(VARCHAR(10),StartDate,103) AS StartDate,CONVERT(VARCHAR(10),EndDate,103) AS EndDate,SUM(ORC) AS ORC,SUM(OFC) AS OFC,SUM(OPRE) AS OPRE,SUM(RRC) AS RRC,SUM(RFC) AS RFC,SUM(RPRE) AS RPRE,SUM(OTotal) AS OTotal,SUM(RTotal) AS RTotal,SUM(RC_Diff) AS RC_Diff,SUM(FC_Diff) AS FC_Diff,SUM(PRE_Diff) AS PRE_Diff,SUM(Total_Difference) AS Total_Difference FROM BUStrips ${where} GROUP BY StartDate,EndDate ORDER BY StartDate DESC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── SNOWTRAVEL BUS ───────────────────────────────────────────────────────────
router.get('/snowtravel-bus', async (req,res)=>{
  try {
    const conds=["dataset='Snowtravel'","status IN ('ok','cancelled')","bus_type_name IS NOT NULL","bus_type_name!='Other'"],p={};
    if(req.query.dateFrom){conds.push('departure_date>=@df');p.df=req.query.dateFrom;}
    if(req.query.dateTo){conds.push('departure_date<=@dt');p.dt=req.query.dateTo;}
    const r=await query(`SELECT CONVERT(VARCHAR(10),departure_date,103) AS departure_date,CONVERT(VARCHAR(10),return_date,103) AS return_date,SUM(CASE WHEN bus_type_name='Dream Class' THEN pax ELSE 0 END) AS dream_class,SUM(CASE WHEN bus_type_name='First Class' THEN pax ELSE 0 END) AS first_class,SUM(pax) AS total_pax FROM bookings WHERE ${conds.join(' AND ')} GROUP BY departure_date,return_date ORDER BY departure_date DESC`,p);
    res.json(r.recordset||[]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─── DATA TABLE (FIXED — dataset filter now works correctly) ──────────────────
router.get('/bookings-table', async (req,res)=>{
  try {
    const dsParam = req.query.dataset || '';
    const isSnow  = dsParam === 'Snowtravel';
    const isOther = dsParam && dsParam !== 'Snowtravel';

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const off   = (page-1)*limit;

    // CustomerOverview conditions
    const coC = ["Status IN ('ok','cancelled')"], coP = {};
    if (isOther) { coC.push('Dataset=@cods'); coP.cods = dsParam; }
    if (req.query.status && req.query.status !== 'all') { coC[0]='Status=@cost'; coP.cost=req.query.status; }
    if (req.query.depFrom)  { coC.push('DepartureDate>=@codf');              coP.codf=req.query.depFrom; }
    if (req.query.depTo)    { coC.push('DepartureDate<=@codt');              coP.codt=req.query.depTo;   }
    if (req.query.bkFrom)   { coC.push('CAST(BookingDate AS DATE)>=@cobf');  coP.cobf=req.query.bkFrom;  }
    if (req.query.bkTo)     { coC.push('CAST(BookingDate AS DATE)<=@cobt');  coP.cobt=req.query.bkTo;    }
    if (req.query.search)   { coC.push('(BookingID LIKE @cos OR LabelName LIKE @cos)'); coP.cos=`%${req.query.search}%`; }
    const coW = 'WHERE '+coC.join(' AND ');

    // ST_Bookings conditions
    const stC = ["status IN ('ok','cancelled')"], stP = {};
    if (req.query.status && req.query.status !== 'all') { stC[0]='status=@stst'; stP.stst=req.query.status; }
    if (req.query.depFrom)  { stC.push('dateDeparture>=@stdf');              stP.stdf=req.query.depFrom; }
    if (req.query.depTo)    { stC.push('dateDeparture<=@stdt');              stP.stdt=req.query.depTo;   }
    if (req.query.bkFrom)   { stC.push('CAST(creationTime AS DATE)>=@stbf'); stP.stbf=req.query.bkFrom;  }
    if (req.query.bkTo)     { stC.push('CAST(creationTime AS DATE)<=@stbt'); stP.stbt=req.query.bkTo;    }
    if (req.query.search)   { stC.push('(CAST(travelFileId AS VARCHAR) LIKE @sts)'); stP.sts=`%${req.query.search}%`; }
    const stW = 'WHERE '+stC.join(' AND ');

    const coSel = `SELECT BookingID,Dataset,Status,LabelName AS Label,LabelCode,CONVERT(VARCHAR(10),BookingDate,103) AS BookingDate,CONVERT(VARCHAR(10),DepartureDate,103) AS DepartureDate,CONVERT(VARCHAR(10),ReturnDate,103) AS ReturnDate,DATEDIFF(day,DepartureDate,ReturnDate) AS Duration,PAXCount AS PAX,ROUND(TotalRevenue,2) AS Revenue,ROUND(CASE WHEN PAXCount>0 THEN TotalRevenue/PAXCount ELSE 0 END,2) AS RevPerPax,TransportType,BusType,DeparturePlace,CustomerCity AS City,CustomerCountry AS Country,DestinationResort AS Destination,DepartureYear AS Year,DepartureMonth AS Month,Reseller FROM CustomerOverview ${coW}`;
    const stSel = `SELECT CAST(travelFileId AS VARCHAR) AS BookingID,'Snowtravel' AS Dataset,status AS Status,'Snowtravel' AS Label,fileNr AS LabelCode,CONVERT(VARCHAR(10),creationTime,103) AS BookingDate,CONVERT(VARCHAR(10),dateDeparture,103) AS DepartureDate,CONVERT(VARCHAR(10),dateReturn,103) AS ReturnDate,DATEDIFF(day,dateDeparture,dateReturn) AS Duration,paxCount AS PAX,ROUND(totalPrice,2) AS Revenue,ROUND(CASE WHEN paxCount>0 THEN totalPrice/paxCount ELSE 0 END,2) AS RevPerPax,wayOfTransport AS TransportType,busType AS BusType,departurePlace AS DeparturePlace,customerCity AS City,customerCountry AS Country,residence AS Destination,YEAR(dateDeparture) AS Year,MONTH(dateDeparture) AS Month,NULL AS Reseller FROM ST_Bookings ${stW}`;

    let rowsSql, cntSql, allP;
    if (isSnow) {
      rowsSql = `${stSel} ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      cntSql  = `SELECT COUNT(*) AS total FROM ST_Bookings ${stW}`;
      allP    = stP;
    } else if (isOther) {
      rowsSql = `${coSel} ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      cntSql  = `SELECT COUNT(*) AS total FROM CustomerOverview ${coW}`;
      allP    = coP;
    } else {
      allP    = { ...coP, ...stP };
      rowsSql = `SELECT * FROM (${coSel} UNION ALL ${stSel}) AS t ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      cntSql  = `SELECT ((SELECT COUNT(*) FROM CustomerOverview ${coW})+(SELECT COUNT(*) FROM ST_Bookings ${stW})) AS total`;
    }
    const [rows,cnt] = await Promise.all([query(rowsSql,allP), query(cntSql,allP)]);
    res.json({ rows:rows.recordset||[], total:cnt.recordset[0]?.total||0, page, limit });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────
router.get('/export', async (req,res)=>{
  try {
    const {whereClause,params}=buildWhere(req.query);
    const r=await query(`SELECT TOP 100000 booking_id AS [Booking ID],dataset AS [Dataset],status AS [Status],CONVERT(VARCHAR(10),booking_date,105) AS [Booking Date],CONVERT(VARCHAR(10),departure_date,105) AS [Departure Date],CONVERT(VARCHAR(10),return_date,105) AS [Return Date],DATEDIFF(day,departure_date,return_date) AS [Duration],pax AS [PAX],ROUND(revenue,2) AS [Revenue EUR],transport_type AS [Transport],bus_type_name AS [Bus Class],destination AS [Destination],region AS [Region],customer_country AS [Country],CAST(year AS VARCHAR) AS [Year],LEFT(DATENAME(month,DATEFROMPARTS(year,month,1)),3) AS [Month] FROM bookings ${ws(whereClause)} ORDER BY departure_date DESC`,params);
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
    const {whereClause,params}=buildWhere(req.query);
    const r=await query(`SELECT TOP 100000 booking_id AS [Booking ID],dataset AS [Dataset],status AS [Status],CONVERT(VARCHAR(10),booking_date,105) AS [Booking Date],CONVERT(VARCHAR(10),departure_date,105) AS [Departure Date],CONVERT(VARCHAR(10),return_date,105) AS [Return Date],DATEDIFF(day,departure_date,return_date) AS [Duration Days],pax AS [PAX],ROUND(revenue,2) AS [Revenue EUR],transport_type AS [Transport],bus_type_name AS [Bus Class],destination AS [Destination],region AS [Region],customer_country AS [Country],CAST(year AS VARCHAR) AS [Year],LEFT(DATENAME(month,DATEFROMPARTS(year,month,1)),3) AS [Month] FROM bookings ${ws(whereClause)} ORDER BY departure_date DESC`,params);
    const rows=r.recordset||[];
    if(!rows.length)return res.status(200).json({error:'No data'});
    const cols=Object.keys(rows[0]);
    // Generate XLSX-compatible XML (SpreadsheetML)
    const xmlRows=rows.map(row=>`<Row>${cols.map(c=>{const v=row[c]??'';const isNum=typeof v==='number';return `<Cell><Data ss:Type="${isNum?'Number':'String'}">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`;}).join('')}</Row>`).join('');
    const hdrRow=`<Row>${cols.map(c=>`<Cell ss:StyleID="header"><Data ss:Type="String">${c}</Data></Cell>`).join('')}</Row>`;
    const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style></Styles><Worksheet ss:Name="TTP Export"><Table>${hdrRow}${xmlRows}</Table></Worksheet></Workbook>`;
    res.setHeader('Content-Type','application/vnd.ms-excel;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment;filename=ttp-export-${new Date().toISOString().split('T')[0]}.xls`);
    res.send(xml);
  } catch(e){res.status(500).json({error:e.message});}
});

export default router;
