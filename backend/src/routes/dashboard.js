import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

// ─── SOURCES ──────────────────────────────────────────────────────────────────
// CustomerOverview: Solmar, Interbus, Solmar DE  (Status: DEF / DEF-GEANNULEERD)
// ST_Bookings:      Snowtravel                   (status: ok / cancelled)

const CO_ALL = `Status IN ('DEF','DEF-GEANNULEERD')`;
const ST_ALL = `status IN ('ok','cancelled')`;

// ─── WHERE BUILDER ────────────────────────────────────────────────────────────
function buildWhere(q, inclPrior = false) {
  const coC = [CO_ALL], coP = {}, stC = [ST_ALL], stP = {};

  if (q.departureDateFrom) {
    coC.push('DepartureDate>=@codf'); coP.codf = q.departureDateFrom;
    stC.push('dateDeparture>=@stdf'); stP.stdf = q.departureDateFrom;
  }
  if (q.departureDateTo) {
    coC.push('DepartureDate<=@codt'); coP.codt = q.departureDateTo;
    stC.push('dateDeparture<=@stdt'); stP.stdt = q.departureDateTo;
  }
  if (q.bookingDateFrom) {
    coC.push('CAST(BookingDate AS DATE)>=@cobf'); coP.cobf = q.bookingDateFrom;
    stC.push('CAST(creationTime AS DATE)>=@stbf'); stP.stbf = q.bookingDateFrom;
  }
  if (q.bookingDateTo) {
    coC.push('CAST(BookingDate AS DATE)<=@cobt'); coP.cobt = q.bookingDateTo;
    stC.push('CAST(creationTime AS DATE)<=@stbt'); stP.stbt = q.bookingDateTo;
  }

  // Dataset
  const ds = [].concat(q.dataset || []).filter(Boolean);
  const solmarDs = ds.filter(d => ['Solmar','Interbus','Solmar DE'].includes(d));
  const hasSnow  = !ds.length || ds.includes('Snowtravel');
  const hasSolmar= !ds.length || solmarDs.length > 0;
  if (solmarDs.length) {
    solmarDs.forEach((d, i) => { coP[`cods${i}`] = d; });
    coC.push(`(${solmarDs.map((_, i) => `Dataset=@cods${i}`).join(' OR ')})`);
  }

  // Status — map frontend values to DB values
  const stFilter = [].concat(q.status || []).filter(Boolean);
  if (stFilter.length && !stFilter.includes('all')) {
    const coMap = stFilter.includes('confirmed') ? `Status='DEF'` : stFilter.includes('cancelled') ? `Status='DEF-GEANNULEERD'` : null;
    const stMap = stFilter.includes('confirmed') ? `status='ok'` : stFilter.includes('cancelled') ? `status='cancelled'` : null;
    if (coMap) coC.push(coMap);
    if (stMap) stC.push(stMap);
  }

  // Transport type (normalize ownTransport → own transport)
  if (q.transportType) {
    const raw = q.transportType === 'own transport' ? 'ownTransport' : q.transportType;
    coC.push(`TransportType=@tt`); coP.tt = raw;
  }

  // Year
  let yr = [].concat(q.year || []).filter(Boolean).map(Number);
  if (yr.length) {
    if (inclPrior) yr = [...new Set([...yr, ...yr.map(y => y - 1)])];
    yr.forEach((y, i) => { coP[`coyr${i}`] = y; stP[`styr${i}`] = y; });
    coC.push(`(${yr.map((_, i) => `DepartureYear=@coyr${i}`).join(' OR ')})`);
    stC.push(`(${yr.map((_, i) => `YEAR(dateDeparture)=@styr${i}`).join(' OR ')})`);
  }

  return {
    coWhere: `WHERE ${coC.join(' AND ')}`, coP,
    stWhere: `WHERE ${stC.join(' AND ')}`, stP,
    hasSolmar, hasSnow,
    origYears: [].concat(q.year || []).map(Number),
  };
}

function unionSql(co, st, hasSolmar, hasSnow) {
  if (hasSolmar && hasSnow)  return `${co} UNION ALL ${st}`;
  if (hasSolmar && !hasSnow) return co;
  return st;
}

// ─── SLICERS ──────────────────────────────────────────────────────────────────
router.get('/slicers', async (req, res) => {
  try {
    const r = await query(`
      SELECT DISTINCT
        CASE WHEN TransportType='ownTransport' THEN 'own transport' ELSE LOWER(TransportType) END AS t
      FROM CustomerOverview
      WHERE TransportType IS NOT NULL AND ${CO_ALL}
      ORDER BY t`);
    res.json({
      transportTypes: [...new Set((r.recordset || []).map(x => x.t).filter(Boolean))]
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── KPIs ─────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req, res) => {
  try {
    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow, origYears } = buildWhere(req.query, true);
    const df = req.query.departureDateFrom;
    const dt = req.query.departureDateTo;
    const hasDateRange = !!(df && dt);
    const curY = origYears.length === 1 ? origYears[0] : new Date().getFullYear();
    const prevY = curY - 1;

    const fmtDMY = s => {
      if (!s) return '';
      const [y, m, d] = s.split('-');
      return `${d}-${m}-${y}`;
    };

    const periodLabel = hasDateRange ? `${fmtDMY(df)} – ${fmtDMY(dt)}`
      : origYears.length === 1 ? `Year ${curY}` : `Year ${curY}`;
    const prevLabel = hasDateRange ? 'Same period prev. year' : `${prevY}`;

    const coBase = `SELECT DepartureYear AS yr, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWhere}`;
    const stBase = `SELECT YEAR(dateDeparture) AS yr, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere}`;
    const union = unionSql(coBase, stBase, hasSolmar, hasSnow);

    let sql, p;
    if (hasDateRange) {
      const prevDf = df.replace(/^(\d{4})/, y => String(parseInt(y) - 1));
      const prevDt = dt.replace(/^(\d{4})/, y => String(parseInt(y) - 1));
      const coP2 = { ...coP, codf2: prevDf, codt2: prevDt };
      const stP2 = { ...stP, stdf2: prevDf, stdt2: prevDt };
      const coPrev = coWhere.replace('@codf','@codf2').replace('@codt','@codt2');
      const stPrev = stWhere.replace('@stdf','@stdf2').replace('@stdt','@stdt2');
      const prevUnion = unionSql(
        `SELECT DepartureYear AS yr, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coPrev}`,
        `SELECT YEAR(dateDeparture) AS yr, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stPrev}`,
        hasSolmar, hasSnow
      );
      sql = `SELECT
        (SELECT COUNT(*) FROM (${union}) t) AS cb,
        (SELECT ISNULL(SUM(pax),0) FROM (${union}) t) AS cp,
        (SELECT ISNULL(ROUND(SUM(revenue),2),0) FROM (${union}) t) AS cr,
        (SELECT COUNT(*) FROM (${prevUnion}) t) AS pb,
        (SELECT ISNULL(SUM(pax),0) FROM (${prevUnion}) t) AS pp,
        (SELECT ISNULL(ROUND(SUM(revenue),2),0) FROM (${prevUnion}) t) AS pr`;
      p = { ...coP2, ...stP2 };
    } else {
      sql = `SELECT
        SUM(CASE WHEN yr=${curY} THEN revenue ELSE 0 END) AS cr,
        SUM(CASE WHEN yr=${prevY} THEN revenue ELSE 0 END) AS pr,
        SUM(CASE WHEN yr=${curY} THEN pax ELSE 0 END) AS cp,
        SUM(CASE WHEN yr=${prevY} THEN pax ELSE 0 END) AS pp,
        COUNT(CASE WHEN yr=${curY} THEN 1 END) AS cb,
        COUNT(CASE WHEN yr=${prevY} THEN 1 END) AS pb
        FROM (${union}) t`;
      p = { ...coP, ...stP };
    }

    const r = (await query(sql, p)).recordset[0] || {};
    const cb = r.cb||0, pb = r.pb||0, cp = r.cp||0, pp = r.pp||0;
    const cr = parseFloat(r.cr)||0, pr = parseFloat(r.pr)||0;

    res.json({
      currentBookings: cb, previousBookings: pb,
      differenceBookings: cb - pb, percentBookings: pb > 0 ? ((cb-pb)/pb)*100 : null,
      currentPax: cp, previousPax: pp,
      differencePax: cp - pp, percentPax: pp > 0 ? ((cp-pp)/pp)*100 : null,
      currentRevenue: cr, previousRevenue: pr,
      differenceRevenue: cr - pr, percentRevenue: pr > 0 ? ((cr-pr)/pr)*100 : null,
      periodLabel, prevLabel,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REVENUE BY YEAR ──────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req, res) => {
  try {
    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow } = buildWhere(req.query);
    const co = `SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWhere} AND DepartureYear BETWEEN 2022 AND 2027`;
    const st = `SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere} AND YEAR(dateDeparture) BETWEEN 2022 AND 2027`;
    const union = unionSql(co, st, hasSolmar, hasSnow);
    const r = await query(`
      SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),2) AS revenue
      FROM (${union}) t GROUP BY yr, mo ORDER BY yr ASC, mo ASC`,
      { ...coP, ...stP });
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── YEAR-MONTH COMPARISON ────────────────────────────────────────────────────
router.get('/year-month-comparison', async (req, res) => {
  try {
    const df = req.query.departureDateFrom;
    const dt = req.query.departureDateTo;
    const hasDateRange = !!(df && dt);
    const yrList = [].concat(req.query.year || []).filter(Boolean);
    const hasYearFilter = yrList.length > 0;

    if (hasDateRange && !hasYearFilter) {
      const prevDf = df.replace(/^(\d{4})/, y => String(parseInt(y) - 1));
      const prevDt = dt.replace(/^(\d{4})/, y => String(parseInt(y) - 1));

      const cur = buildWhere(req.query, false);
      const prev = buildWhere({ ...req.query, departureDateFrom: prevDf, departureDateTo: prevDt }, false);

      const coWherePrev = prev.coWhere.replace('@codf', '@codf2').replace('@codt', '@codt2');
      const stWherePrev = prev.stWhere.replace('@stdf', '@stdf2').replace('@stdt', '@stdt2');

      const coPPrev = { ...prev.coP };
      if (Object.prototype.hasOwnProperty.call(coPPrev, 'codf')) { coPPrev.codf2 = coPPrev.codf; delete coPPrev.codf; }
      if (Object.prototype.hasOwnProperty.call(coPPrev, 'codt')) { coPPrev.codt2 = coPPrev.codt; delete coPPrev.codt; }
      const stPPrev = { ...prev.stP };
      if (Object.prototype.hasOwnProperty.call(stPPrev, 'stdf')) { stPPrev.stdf2 = stPPrev.stdf; delete stPPrev.stdf; }
      if (Object.prototype.hasOwnProperty.call(stPPrev, 'stdt')) { stPPrev.stdt2 = stPPrev.stdt; delete stPPrev.stdt; }

      const coCur = `SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${cur.coWhere} AND DepartureYear BETWEEN 2022 AND 2027`;
      const stCur = `SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${cur.stWhere} AND YEAR(dateDeparture) BETWEEN 2022 AND 2027`;
      const unionCur = unionSql(coCur, stCur, cur.hasSolmar, cur.hasSnow);

      const coP = `SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWherePrev} AND DepartureYear BETWEEN 2022 AND 2027`;
      const stP = `SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWherePrev} AND YEAR(dateDeparture) BETWEEN 2022 AND 2027`;
      const unionPrev = unionSql(coP, stP, prev.hasSolmar, prev.hasSnow);

      const r = await query(`
        WITH currentBase AS (
          SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),2) AS revenue
          FROM (${unionCur}) t GROUP BY yr, mo
        ),
        prevBase AS (
          SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),2) AS revenue
          FROM (${unionPrev}) t GROUP BY yr, mo
        )
        SELECT
          a.year, a.month,
          a.bookings AS currentBookings, ISNULL(b.bookings,0) AS previousBookings,
          a.pax AS currentPax, ISNULL(b.pax,0) AS previousPax,
          a.revenue AS currentRevenue, ISNULL(b.revenue,0) AS previousRevenue,
          a.bookings - ISNULL(b.bookings,0) AS diffBookings,
          a.pax - ISNULL(b.pax,0) AS diffPax,
          a.revenue - ISNULL(b.revenue,0) AS diffRevenue,
          CASE WHEN ISNULL(b.bookings,0)>0 THEN ROUND((CAST(a.bookings AS FLOAT)-b.bookings)/b.bookings*100,1) ELSE NULL END AS diffPctBookings,
          CASE WHEN ISNULL(b.pax,0)>0 THEN ROUND((CAST(a.pax AS FLOAT)-b.pax)/b.pax*100,1) ELSE NULL END AS diffPctPax,
          CASE WHEN ISNULL(b.revenue,0)>0 THEN ROUND((a.revenue-b.revenue)/b.revenue*100,1) ELSE NULL END AS diffPctRevenue
        FROM currentBase a
        LEFT JOIN prevBase b ON b.year = a.year-1 AND b.month = a.month
        ORDER BY a.year DESC, a.month DESC
      `, { ...cur.coP, ...cur.stP, ...coPPrev, ...stPPrev });

      res.json(r.recordset || []);
      return;
    }

    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow } = buildWhere(req.query, true);
    const co = `SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWhere} AND DepartureYear BETWEEN 2022 AND 2027`;
    const st = `SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere} AND YEAR(dateDeparture) BETWEEN 2022 AND 2027`;
    const union = unionSql(co, st, hasSolmar, hasSnow);
    const r = await query(`
      WITH base AS (
        SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),2) AS revenue
        FROM (${union}) t GROUP BY yr, mo
      )
      SELECT
        a.year, a.month,
        a.bookings AS currentBookings, ISNULL(b.bookings,0) AS previousBookings,
        a.pax AS currentPax, ISNULL(b.pax,0) AS previousPax,
        a.revenue AS currentRevenue, ISNULL(b.revenue,0) AS previousRevenue,
        a.bookings - ISNULL(b.bookings,0) AS diffBookings,
        a.pax - ISNULL(b.pax,0) AS diffPax,
        a.revenue - ISNULL(b.revenue,0) AS diffRevenue,
        CASE WHEN ISNULL(b.bookings,0)>0 THEN ROUND((CAST(a.bookings AS FLOAT)-b.bookings)/b.bookings*100,1) ELSE NULL END AS diffPctBookings,
        CASE WHEN ISNULL(b.pax,0)>0 THEN ROUND((CAST(a.pax AS FLOAT)-b.pax)/b.pax*100,1) ELSE NULL END AS diffPctPax,
        CASE WHEN ISNULL(b.revenue,0)>0 THEN ROUND((a.revenue-b.revenue)/b.revenue*100,1) ELSE NULL END AS diffPctRevenue
      FROM base a
      LEFT JOIN base b ON b.year = a.year-1 AND b.month = a.month
      ORDER BY a.year DESC, a.month DESC`,
      { ...coP, ...stP });
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUS STATUS MAP ───────────────────────────────────────────────────────────
// confirmed → DEF | temporary → TIJD | lapsed → VERV | cancelled → DEF-GEANNULEERD
const BUS_STATUS_MAP = { confirmed:'DEF', temporary:'TIJD', lapsed:'VERV', cancelled:'DEF-GEANNULEERD' };

function buildBusStatusCond(busStatus, p, prefix = 'bs') {
  if (!busStatus || busStatus === 'all') return null;
  const dbSt = busStatus.split(',')
    .map(s => BUS_STATUS_MAP[s.trim()] || s.trim())
    .filter(Boolean);
  if (!dbSt.length) return null;
  dbSt.forEach((s, i) => { p[`${prefix}${i}`] = s; });
  return `Status IN (${dbSt.map((_, i) => `@${prefix}${i}`).join(',')})`;
}

// ─── BUS KPIs ─────────────────────────────────────────────────────────────────
router.get('/bus-kpis', async (req, res) => {
  try {
    const conds = [], p = {};
    const stCond = buildBusStatusCond(req.query.busStatus, p);
    if (stCond) conds.push(stCond);
    if (req.query.dateFrom) { conds.push('dateDeparture>=@df'); p.df = req.query.dateFrom; }
    if (req.query.dateTo)   { conds.push('dateDeparture<=@dt'); p.dt = req.query.dateTo; }
    if (req.query.region)   { conds.push('Region=@rg'); p.rg = req.query.region; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(`
      SELECT
        SUM(PAX) AS total_pax,
        COUNT(DISTINCT id) AS total_bookings,
        SUM(CASE WHEN Outbound_Class='Royal Class'   THEN PAX ELSE 0 END) AS royal_pax,
        SUM(CASE WHEN Outbound_Class='First Class'   THEN PAX ELSE 0 END) AS first_pax,
        SUM(CASE WHEN Outbound_Class='Premium Class' THEN PAX ELSE 0 END) AS premium_pax,
        SUM(CASE WHEN Status='DEF'  THEN PAX ELSE 0 END) AS confirmed_pax,
        SUM(CASE WHEN Status='TIJD' THEN PAX ELSE 0 END) AS temp_pax,
        SUM(CASE WHEN Status='VERV' THEN PAX ELSE 0 END) AS lapsed_pax,
        SUM(CASE WHEN Status='DEF-GEANNULEERD' OR Status='VERV' THEN PAX ELSE 0 END) AS cancelled_pax
      FROM solmar_bus_bookings_modified ${where}`, p);
    res.json(r.recordset[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUS PENDEL (BUStrips — grouped by date only, never split by pendel name) ─
router.get('/bus-pendel', async (req, res) => {
  try {
    const conds = [], p = {};
    if (req.query.dateFrom) { conds.push('StartDate>=@df'); p.df = req.query.dateFrom; }
    if (req.query.dateTo)   { conds.push('StartDate<=@dt'); p.dt = req.query.dateTo; }
    if (req.query.weekday)  { conds.push('DATENAME(weekday,StartDate)=@wd'); p.wd = req.query.weekday; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(`
      SELECT
        CONVERT(VARCHAR(10),StartDate,105) AS StartDate,
        CONVERT(VARCHAR(10),EndDate,105)   AS EndDate,
        SUM(ORC)  AS ORC,  SUM(OFC)  AS OFC,  SUM(OPRE)  AS OPRE,
        SUM(OTotal) AS Outbound_Total,
        SUM(RRC)  AS RRC,  SUM(RFC)  AS RFC,  SUM(RPRE)  AS RPRE,
        SUM(RTotal) AS Inbound_Total,
        SUM(RC_Diff)        AS Diff_Royal,
        SUM(FC_Diff)        AS Diff_First,
        SUM(PRE_Diff)       AS Diff_Premium,
        SUM(Total_Difference) AS Diff_Total
      FROM BUStrips ${where}
      GROUP BY StartDate, EndDate
      ORDER BY CAST(StartDate AS DATE) ASC`, p);
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUS FEEDER (FeederOverview) ──────────────────────────────────────────────
router.get('/bus-feeder', async (req, res) => {
  try {
    const conds = [], p = {};
    if (req.query.dateFrom)    { conds.push('DepartureDate>=@df'); p.df = req.query.dateFrom; }
    if (req.query.dateTo)      { conds.push('DepartureDate<=@dt'); p.dt = req.query.dateTo; }
    if (req.query.feederLine)  { conds.push('FeederLine=@fl'); p.fl = req.query.feederLine; }
    if (req.query.label)       { conds.push('LabelName=@lb'); p.lb = req.query.label; }
    if (req.query.direction)   { conds.push('Direction=@dir'); p.dir = req.query.direction; }
    if (req.query.weekday)     { conds.push('DATENAME(weekday,DepartureDate)=@wd'); p.wd = req.query.weekday; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(`
      SELECT
        CONVERT(VARCHAR(10),DepartureDate,105) AS DepartureDate,
        LabelName, FeederLine, RouteNo, RouteLabel, StopName, StopType, Direction,
        SUM(TotalPax) AS TotalPax, SUM(BookingCount) AS BookingCount
      FROM FeederOverview ${where}
      GROUP BY DepartureDate, LabelName, FeederLine, RouteNo, RouteLabel, StopName, StopType, Direction
      ORDER BY DepartureDate ASC, RouteNo ASC, StopName ASC`, p);
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUS DECK (solmar_bus_bookings_modified) ──────────────────────────────────
// FIX: was using Date/Direction/Pendel_Inbound which don't exist in this table.
// Correct field is dateDeparture; no Direction column; no Pendel_Inbound column.
router.get('/bus-deck', async (req, res) => {
  try {
    const conds = [], p = {};

    // Status filter — lapsed=VERV, cancelled=DEF-GEANNULEERD (distinct meanings)
    const stCond = buildBusStatusCond(req.query.busStatus, p, 'ds');
    if (stCond) conds.push(stCond);

    // dateDeparture is the correct field name in solmar_bus_bookings_modified
    if (req.query.dateFrom) { conds.push('dateDeparture>=@df'); p.df = req.query.dateFrom; }
    if (req.query.dateTo)   { conds.push('dateDeparture<=@dt'); p.dt = req.query.dateTo; }
    if (req.query.region)   { conds.push('Region=@rg'); p.rg = req.query.region; }
    // Pendel_Inbound does not exist in solmar_bus_bookings_modified — filter on Pendel_Outbound only
    if (req.query.pendel)   { conds.push('Pendel_Outbound LIKE @pd'); p.pd = `%${req.query.pendel}%`; }
    // Weekday filter using dateDeparture
    if (req.query.weekday)  { conds.push('DATENAME(weekday,dateDeparture)=@wd'); p.wd = req.query.weekday; }
    // NOTE: Direction column does NOT exist in solmar_bus_bookings_modified — removed

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(`
      SELECT
        CONVERT(VARCHAR(10),dateDeparture,105) AS dateDeparture,
        -- Deck logic: Garantie Onderdek=Lower | Garantie Bovendek=Upper | Geen garantie=No Deck
        SUM(PAX) AS Total,
        SUM(CASE WHEN Outbound_Class='Royal Class'   THEN PAX ELSE 0 END) AS Royal_Total,
        SUM(CASE WHEN Outbound_Class='Royal Class'   AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_Lower,
        SUM(CASE WHEN Outbound_Class='Royal Class'   AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_Upper,
        SUM(CASE WHEN Outbound_Class='Royal Class'   AND Outbound_Deck LIKE '%Geen%' THEN PAX ELSE 0 END) AS Royal_NoDeck,
        SUM(CASE WHEN Outbound_Class='First Class'   THEN PAX ELSE 0 END) AS First_Total,
        SUM(CASE WHEN Outbound_Class='First Class'   AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_Lower,
        SUM(CASE WHEN Outbound_Class='First Class'   AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_Upper,
        SUM(CASE WHEN Outbound_Class='First Class'   AND Outbound_Deck LIKE '%Geen%' THEN PAX ELSE 0 END) AS First_NoDeck,
        SUM(CASE WHEN Outbound_Class='Premium Class' THEN PAX ELSE 0 END) AS Premium_Total,
        SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_Lower,
        SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_Upper,
        SUM(CASE WHEN Outbound_Class='Premium Class' AND Outbound_Deck LIKE '%Geen%' THEN PAX ELSE 0 END) AS Premium_NoDeck,
        SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_Lower,
        SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_Upper,
        SUM(CASE WHEN Outbound_Deck LIKE '%Geen%' THEN PAX ELSE 0 END) AS Total_NoDeck
      FROM solmar_bus_bookings_modified ${where}
      GROUP BY dateDeparture
      ORDER BY CAST(dateDeparture AS DATE) ASC`, p);
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUS SLICERS ──────────────────────────────────────────────────────────────
// FIX: was querying solmar_bus_pendel_weekly (which has Direction col) but deck
// endpoint reads solmar_bus_bookings_modified — slicers must match the same table.
router.get('/bus-slicers', async (req, res) => {
  try {
    const [regions, pendels] = await Promise.all([
      query(`SELECT DISTINCT Region AS val
             FROM solmar_bus_bookings_modified
             WHERE Region IS NOT NULL AND LTRIM(RTRIM(Region))!=''
             ORDER BY Region`),
      query(`SELECT DISTINCT Pendel_Outbound AS val
             FROM solmar_bus_bookings_modified
             WHERE Pendel_Outbound IS NOT NULL AND LTRIM(RTRIM(Pendel_Outbound))!=''
             ORDER BY Pendel_Outbound`),
    ]);
    res.json({
      regions:  (regions.recordset  || []).map(r => r.val).filter(Boolean),
      pendels:  (pendels.recordset  || []).map(r => r.val).filter(Boolean),
      weekdays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FEEDER SLICERS (FeederOverview) ──────────────────────────────────────────
router.get('/feeder-slicers', async (req, res) => {
  try {
    const [lines, labels] = await Promise.all([
      query(`SELECT DISTINCT FeederLine AS val FROM FeederOverview WHERE FeederLine IS NOT NULL AND LTRIM(RTRIM(FeederLine))!='' ORDER BY FeederLine`),
      query(`SELECT DISTINCT LabelName AS val FROM FeederOverview WHERE LabelName IS NOT NULL AND LTRIM(RTRIM(LabelName))!='' ORDER BY LabelName`),
    ]);
    res.json({
      feederLines: (lines.recordset  || []).map(r => r.val).filter(Boolean),
      labels:      (labels.recordset || []).map(r => r.val).filter(Boolean),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BOOKINGS TABLE ───────────────────────────────────────────────────────────
router.get('/bookings-table', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const off   = (page - 1) * limit;

    const hasDepFrom = !!req.query.departureDateFrom;
    const hasDepTo   = !!req.query.departureDateTo;
    const hasBookFrom= !!req.query.bookingDateFrom;
    const hasBookTo  = !!req.query.bookingDateTo;
    const hasYear    = req.query.year != null && [].concat(req.query.year).filter(Boolean).length > 0;
    const hasDataset = req.query.dataset != null && [].concat(req.query.dataset).filter(Boolean).length > 0;
    const hasAnyDate = hasDepFrom || hasDepTo || hasBookFrom || hasBookTo;
    if (!hasAnyDate && !hasYear && !hasDataset) {
      const curY = new Date().getFullYear();
      req.query.departureDateFrom = `${curY - 1}-01-01`;
    }

    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow } = buildWhere(req.query);

    const coSel = `SELECT
      BookingID,
      Dataset,
      CASE WHEN Status='DEF' THEN 'Confirmed' ELSE 'Cancelled' END AS Status,
      LabelName AS Label,
      CONVERT(VARCHAR(10),CAST(BookingDate AS DATE),105) AS BookingDate,
      CONVERT(VARCHAR(10),DepartureDate,105) AS DepartureDate,
      CONVERT(VARCHAR(10),ReturnDate,105) AS ReturnDate,
      PAXCount AS PAX,
      ROUND(TotalRevenue,2) AS Revenue,
      CASE WHEN TransportType='ownTransport' THEN 'own transport' ELSE LOWER(ISNULL(TransportType,'')) END AS TransportType,
      ISNULL(BusType,'') AS BusClass,
      ISNULL(CustomerCity,'') AS City,
      ISNULL(CustomerCountry,'') AS Country
      FROM CustomerOverview ${coWhere}`;
    const stSel = `SELECT
      CAST(travelFileId AS VARCHAR) AS BookingID,
      'Snowtravel' AS Dataset,
      CASE WHEN status='ok' THEN 'Confirmed' ELSE 'Cancelled' END AS Status,
      'Snowtravel' AS Label,
      CONVERT(VARCHAR(10),CAST(creationTime AS DATE),105) AS BookingDate,
      CONVERT(VARCHAR(10),dateDeparture,105) AS DepartureDate,
      CONVERT(VARCHAR(10),dateReturn,105) AS ReturnDate,
      paxCount AS PAX,
      ROUND(totalPrice,2) AS Revenue,
      '' AS TransportType, '' AS BusClass, '' AS City, '' AS Country
      FROM ST_Bookings ${stWhere}`;

    const union = unionSql(coSel, stSel, hasSolmar, hasSnow);
    const rowsSql = `SELECT * FROM (${union}) t ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    const cntSql  = `SELECT COUNT(*) AS total FROM (${union}) t`;

    const [rows, cnt] = await Promise.all([
      query(rowsSql, { ...coP, ...stP }),
      query(cntSql,  { ...coP, ...stP }),
    ]);
    res.json({ rows: rows.recordset || [], total: cnt.recordset[0]?.total || 0, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HOTEL STATS ──────────────────────────────────────────────────────────────
router.get('/hotel-stats', async (req, res) => {
  try {
    const r = await query(`SELECT
      (SELECT COUNT(*) FROM HotelRatings) AS total_hotels,
      (SELECT COUNT(*) FROM HotelReviews) AS total_reviews,
      (SELECT ROUND(AVG(CAST(avg_overall AS FLOAT)),1) FROM HotelRatings WHERE avg_overall IS NOT NULL) AS avg_rating,
      (SELECT COUNT(*) FROM HotelRatings WHERE avg_overall >= 80) AS high_rated,
      (SELECT MAX(review_date) FROM HotelReviews) AS latest_review`);
    res.json(r.recordset[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HOTEL RATINGS ────────────────────────────────────────────────────────────
router.get('/hotel-ratings', async (req, res) => {
  try {
    const conds = [], p = {};
    if (req.query.search) { conds.push('accommodation_name LIKE @s'); p.s = `%${req.query.search}%`; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(`
      SELECT TOP 200
        accommodation_code, accommodation_name, avg_overall, avg_location,
        avg_cleanliness, avg_service, avg_facilities, avg_sleep,
        total_reviews, recommendation_pct, snapshot_date
      FROM HotelRatings ${where}
      ORDER BY total_reviews DESC`, p);
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HOTEL REVIEWS ────────────────────────────────────────────────────────────
router.get('/hotel-reviews', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const off   = (page - 1) * limit;
    const conds = [], p = {};
    if (req.query.code)      { conds.push('accommodation_code=@code');    p.code    = req.query.code; }
    if (req.query.country)   { conds.push('reviewer_country=@country');   p.country = req.query.country; }
    if (req.query.minRating) { conds.push('overall_rating>=@min');         p.min     = parseInt(req.query.minRating); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows, cnt] = await Promise.all([
      query(`SELECT id, accommodation_code, accommodation_name, review_date,
        overall_rating, review_title, review_text, reviewer_name,
        reviewer_city, reviewer_country, travel_type, language
        FROM HotelReviews ${where}
        ORDER BY review_date DESC
        OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`, p),
      query(`SELECT COUNT(*) AS total FROM HotelReviews ${where}`, p),
    ]);
    res.json({ rows: rows.recordset || [], total: cnt.recordset[0]?.total || 0, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─── MARGIN / PURCHASE OBLIGATIONS (solmar.MarginOverview) ──────────────────────
router.get('/margin-slicers', async (req, res) => {
  try {
    const r = await query(`
      SELECT DISTINCT StatusCode AS val
      FROM solmar.MarginOverview
      WHERE StatusCode IS NOT NULL AND LTRIM(RTRIM(StatusCode))!=''
      ORDER BY StatusCode`);
    res.json({
      statuses: (r.recordset || []).map(x => x.val).filter(Boolean),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/margin-overview', async (req, res) => {
  try {
    const conds = [], p = {};
    if (req.query.depFrom)  { conds.push('DepartureDate>=@df'); p.df = req.query.depFrom; }
    if (req.query.depTo)    { conds.push('DepartureDate<=@dt'); p.dt = req.query.depTo; }
    if (req.query.retFrom)  { conds.push('ReturnDate>=@rf'); p.rf = req.query.retFrom; }
    if (req.query.retTo)    { conds.push('ReturnDate<=@rt'); p.rt = req.query.retTo; }
    if (req.query.status && req.query.status !== 'all') {
      conds.push('StatusCode=@sc'); p.sc = req.query.status;
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await query(`
      SELECT
        COUNT(*) AS total_bookings,
        ISNULL(SUM(SalesBooking),0) AS total_sales,
        ISNULL(SUM(PurchaseCalculation),0) AS total_purchase_calc,
        ISNULL(SUM(PurchaseObligation),0) AS total_purchase_obl,
        ISNULL(SUM(Margin),0) AS total_margin,
        ISNULL(SUM(Commission),0) AS total_commission,
        ISNULL(SUM(MarginIncludingCommission),0) AS total_margin_incl_comm
      FROM solmar.MarginOverview ${where}`, p);
    const kpis = r.recordset[0] || {};

    const rows = await query(`
      SELECT TOP 500
        BookingID,
        StatusCode,
        CONVERT(VARCHAR(10),BookingDate,105) AS BookingDate,
        CONVERT(VARCHAR(10),DepartureDate,105) AS DepartureDate,
        CONVERT(VARCHAR(10),ReturnDate,105) AS ReturnDate,
        ROUND(ISNULL(SalesBooking,0),2) AS SalesBooking,
        ROUND(ISNULL(PurchaseCalculation,0),2) AS PurchaseCalculation,
        ROUND(ISNULL(PurchaseObligation,0),2) AS PurchaseObligation,
        ROUND(ISNULL(Margin,0),2) AS Margin,
        ROUND(ISNULL(Commission,0),2) AS Commission,
        ROUND(ISNULL(MarginIncludingCommission,0),2) AS MarginIncludingCommission
      FROM solmar.MarginOverview ${where}
      ORDER BY DepartureDate DESC`, p);

    res.json({ kpis, rows: rows.recordset || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
