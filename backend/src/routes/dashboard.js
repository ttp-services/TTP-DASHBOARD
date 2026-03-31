import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

// ─── DATA SOURCES (Last Verified: 27-03-2026) ───────────────────────────────
// CustomerOverview: Solmar, Interbus, Solmar DE
// ST_Bookings: Snowtravel

const CO_ALL = `Status IN ('DEF','DEF-GEANNULEERD')`;
const ST_ALL = `status IN ('ok','cancelled')`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Builds the WHERE clause for main overview queries.
 * @param {Object} q - The request query parameters.
 * @param {boolean} includePriorYear - If true, expands the year filter to include Y-1 for comparison.
 */
function buildOverviewWhere(q, includePriorYear = false) {
  const coC = [CO_ALL], coP = {}, stC = [ST_ALL], stP = {};

  // Date Range Filters
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

  // Dataset Filter
  const ds = [].concat(q.dataset || []).filter(Boolean);
  const solmarDs = ds.filter(d => ['Solmar', 'Interbus', 'Solmar DE'].includes(d));
  const hasSnow = !ds.length || ds.includes('Snowtravel');
  const hasSolmar = !ds.length || solmarDs.length > 0;

  if (solmarDs.length) {
    solmarDs.forEach((d, i) => { coP[`cods${i}`] = d; });
    coC.push(`(${solmarDs.map((_, i) => `Dataset=@cods${i}`).join(' OR ')})`);
  }

  // Status Filter
  const stFilter = [].concat(q.status || []).filter(Boolean);
  if (stFilter.length) {
    if (stFilter.includes('ok') && !stFilter.includes('cancelled')) {
      coC.push(`Status='DEF'`); stC.push(`status='ok'`);
    } else if (stFilter.includes('cancelled') && !stFilter.includes('ok')) {
      coC.push(`Status='DEF-GEANNULEERD'`); stC.push(`status='cancelled'`);
    }
  }

  // Year Filter (with YoY logic)
  let yr = [].concat(q.year || []).filter(Boolean).map(Number);
  if (yr.length) {
    if (includePriorYear) {
      // Expand years to include the year before each selected year
      const priorYears = yr.map(y => y - 1);
      yr = [...new Set([...yr, ...priorYears])];
    }
    yr.forEach((y, i) => { coP[`coyr${i}`] = y; stP[`styr${i}`] = y; });
    coC.push(`(${yr.map((_, i) => `DepartureYear=@coyr${i}`).join(' OR ')})`);
    stC.push(`(${yr.map((_, i) => `YEAR(dateDeparture)=@styr${i}`).join(' OR ')})`);
  }

  return {
    coWhere: `WHERE ${coC.join(' AND ')}`,
    coP,
    stWhere: `WHERE ${stC.join(' AND ')}`,
    stP,
    hasSolmar,
    hasSnow,
    originalYears: [].concat(q.year || []).map(Number)
  };
}

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

router.get('/slicers', async (req, res) => {
  try {
    const r = await query(`SELECT DISTINCT LOWER(REPLACE(TransportType,'ownTransport','own transport')) AS t FROM CustomerOverview WHERE TransportType IS NOT NULL AND ${CO_ALL} ORDER BY t`);
    res.json({ transportTypes: [...new Set((r.recordset || []).map(x => x.t).filter(Boolean))] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/kpis', async (req, res) => {
  try {
    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow, originalYears } = buildOverviewWhere(req.query, true);
    const departureDateFrom = req.query.departureDateFrom;
    const departureDateTo = req.query.departureDateTo;
    const hasFullDateRange = !!(departureDateFrom && departureDateTo);
    const yearFilter = [].concat(req.query.year || []).filter(Boolean)[0];
    const yearFilterNum = yearFilter ? parseInt(yearFilter, 10) : null;

    // Determine the "Current" and "Previous" labels
    const currentYear = new Date().getFullYear();
    const curY = originalYears.length === 1 ? originalYears[0] : currentYear;
    const prevY = curY - 1;

    const fmtDMY = (iso) => {
      // Expected input: YYYY-MM-DD
      if (!iso || typeof iso !== 'string') return '';
      const parts = iso.split('-');
      if (parts.length !== 3) return iso;
      const [y, m, d] = parts;
      return `${d}-${m}-${y}`;
    };

    const periodLabel =
      hasFullDateRange
        ? `${fmtDMY(departureDateFrom)} → ${fmtDMY(departureDateTo)}`
        : yearFilterNum && !departureDateFrom && !departureDateTo
          ? `Year ${yearFilterNum}`
          : `Year ${currentYear}`;

    const prevLabel =
      hasFullDateRange
        ? 'Same period prev. year'
        : `Year ${prevY}`;

    const coBase = `SELECT DepartureYear AS yr, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWhere}`;
    const stBase = `SELECT YEAR(dateDeparture) AS yr, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere}`;
    
    let unionSql = (hasSolmar && hasSnow) ? `${coBase} UNION ALL ${stBase}` : (hasSnow ? stBase : coBase);

    const sql = `
      SELECT 
        SUM(CASE WHEN yr = ${curY} THEN revenue ELSE 0 END) AS cr,
        SUM(CASE WHEN yr = ${prevY} THEN revenue ELSE 0 END) AS pr,
        SUM(CASE WHEN yr = ${curY} THEN pax ELSE 0 END) AS cp,
        SUM(CASE WHEN yr = ${prevY} THEN pax ELSE 0 END) AS pp,
        COUNT(CASE WHEN yr = ${curY} THEN 1 END) AS cb,
        COUNT(CASE WHEN yr = ${prevY} THEN 1 END) AS pb
      FROM (${unionSql}) t`;

    const r = (await query(sql, { ...coP, ...stP })).recordset[0] || {};
    
    const cb = r.cb || 0, pb = r.pb || 0;
    const cp = r.cp || 0, pp = r.pp || 0;
    const cr = parseFloat(r.cr) || 0, pr = parseFloat(r.pr) || 0;

    res.json({
      currentBookings: cb, previousBookings: pb, differenceBookings: cb - pb, percentBookings: pb > 0 ? ((cb - pb) / pb) * 100 : null,
      currentPax: cp, previousPax: pp, differencePax: cp - pp, percentPax: pp > 0 ? ((cp - pp) / pp) * 100 : null,
      currentRevenue: cr, previousRevenue: pr, differenceRevenue: cr - pr, percentRevenue: pr > 0 ? ((cr - pr) / pr) * 100 : null,
      periodLabel, prevLabel
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/revenue-by-year', async (req, res) => {
  try {
    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow } = buildOverviewWhere(req.query);
    const co = `SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWhere}`;
    const st = `SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere}`;
    const unionSql = (hasSolmar && hasSnow) ? `${co} UNION ALL ${st}` : (hasSnow ? st : co);

    const r = await query(`
      SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue), 2) AS revenue 
      FROM (${unionSql}) t 
      GROUP BY yr, mo 
      ORDER BY yr ASC, mo ASC`, { ...coP, ...stP });
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/year-month-comparison', async (req, res) => {
  try {
    // forceIncludePriorYear=true ensures we have data for the 'b' side of the join
    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow } = buildOverviewWhere(req.query, true);
    const co = `SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue FROM CustomerOverview ${coWhere}`;
    const st = `SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue FROM ST_Bookings ${stWhere}`;
    const unionSql = (hasSolmar && hasSnow) ? `${co} UNION ALL ${st}` : (hasSnow ? st : co);

    const r = await query(`
      WITH base AS (
        SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue), 2) AS revenue 
        FROM (${unionSql}) t 
        GROUP BY yr, mo
      )
      SELECT 
        a.year, a.month, 
        a.bookings AS currentBookings, ISNULL(b.bookings, 0) AS previousBookings,
        (a.bookings - ISNULL(b.bookings, 0)) AS diffBookings,
        a.pax AS currentPax, ISNULL(b.pax, 0) AS previousPax,
        (a.pax - ISNULL(b.pax, 0)) AS diffPax,
        a.revenue AS currentRevenue, ISNULL(b.revenue, 0) AS previousRevenue,
        CASE WHEN ISNULL(b.bookings,0)>0 THEN ROUND(CAST(a.bookings-b.bookings AS FLOAT)/b.bookings*100,1) ELSE NULL END AS diffPctBookings,
        CASE WHEN ISNULL(b.pax,0)>0      THEN ROUND(CAST(a.pax-b.pax AS FLOAT)/b.pax*100,1) ELSE NULL END AS diffPctPax,
        (a.revenue - ISNULL(b.revenue, 0)) AS diffRevenue,
        CASE WHEN ISNULL(b.revenue, 0) > 0 THEN ROUND(((a.revenue - b.revenue) / b.revenue) * 100, 1) ELSE NULL END AS diffPctRevenue
      FROM base a 
      LEFT JOIN base b ON b.year = a.year - 1 AND b.month = a.month
      ORDER BY a.year DESC, a.month DESC`, { ...coP, ...stP });
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BUS SECTION ─────────────────────────────────────────────────────────────

router.get('/bus-kpis', async (req, res) => {
  try {
    const conds = ["Status='DEF'"], p = {};
    if (req.query.dateFrom) { conds.push('dateDeparture>=@df'); p.df = req.query.dateFrom; }
    if (req.query.dateTo) { conds.push('dateDeparture<=@dt'); p.dt = req.query.dateTo; }
    if (req.query.pendel) { conds.push('(Pendel_Outbound LIKE @pd OR Pendel_Inbound LIKE @pd)'); p.pd = `%${req.query.pendel}%`; }
    if (req.query.region) { conds.push('Region=@rg'); p.rg = req.query.region; }
    
    const where = 'WHERE ' + conds.join(' AND ');
    const r = await query(`
      SELECT 
        SUM(PAX) AS total_pax, COUNT(DISTINCT Booking_Number) AS total_bookings,
        SUM(CASE WHEN Outbound_Class='Royal Class' THEN PAX ELSE 0 END) AS royal_pax,
        SUM(CASE WHEN Outbound_Class='First Class' THEN PAX ELSE 0 END) AS first_pax,
        SUM(CASE WHEN Outbound_Class='Premium Class' THEN PAX ELSE 0 END) AS premium_pax,
        SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' THEN PAX ELSE 0 END) AS lower_pax,
        SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' THEN PAX ELSE 0 END) AS upper_pax
      FROM solmar_bus_bookings_modified ${where}`, p);
    res.json(r.recordset[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/deck-class', async (req, res) => {
  try {
    const conds = ["Status='DEF'", "Direction='Outbound'"], p = {};
    if (req.query.dateFrom) { conds.push('Date>=@df'); p.df = req.query.dateFrom; }
    if (req.query.dateTo) { conds.push('Date<=@dt'); p.dt = req.query.dateTo; }
    
    const r = await query(`
      SELECT 
        CONVERT(VARCHAR(10), Date, 103) AS dateDeparture,
        SUM(PAX) AS Total,
        SUM(CASE WHEN Outbound_Deck LIKE '%Onderdek%' THEN PAX ELSE 0 END) AS Total_Lower,
        SUM(CASE WHEN Outbound_Deck LIKE '%Bovendek%' THEN PAX ELSE 0 END) AS Total_Upper,
        SUM(CASE WHEN Outbound_Class='Royal Class' THEN PAX ELSE 0 END) AS Royal_Total,
        SUM(CASE WHEN Outbound_Class='First Class' THEN PAX ELSE 0 END) AS First_Total
      FROM solmar_bus_deck_weekly 
      WHERE ${conds.join(' AND ')}
      GROUP BY Date ORDER BY CAST(Date AS DATE) ASC`, p);
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BOOKINGS TABLE & EXPORTS ────────────────────────────────────────────────

router.get('/bookings-table', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const off = (page - 1) * limit;
    const { coWhere, coP, stWhere, stP, hasSolmar, hasSnow } = buildOverviewWhere(req.query);

    const coSel = `SELECT BookingID, Dataset, Status, LabelName AS Label, CONVERT(VARCHAR(10),DepartureDate,103) AS DepartureDate, PAXCount AS PAX, ROUND(TotalRevenue,2) AS Revenue FROM CustomerOverview ${coWhere}`;
    const stSel = `SELECT CAST(travelFileId AS VARCHAR) AS BookingID, 'Snowtravel' AS Dataset, status AS Status, 'Snowtravel' AS Label, CONVERT(VARCHAR(10),dateDeparture,103) AS DepartureDate, paxCount AS PAX, ROUND(totalPrice,2) AS Revenue FROM ST_Bookings ${stWhere}`;

    let rowsSql, cntSql;
    if (hasSolmar && !hasSnow) {
      rowsSql = `${coSel} ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      cntSql = `SELECT COUNT(*) AS total FROM CustomerOverview ${coWhere}`;
    } else if (hasSnow && !hasSolmar) {
      rowsSql = `${stSel} ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      cntSql = `SELECT COUNT(*) AS total FROM ST_Bookings ${stWhere}`;
    } else {
      rowsSql = `SELECT * FROM (${coSel} UNION ALL ${stSel}) AS t ORDER BY DepartureDate DESC OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      cntSql = `SELECT (SELECT COUNT(*) FROM CustomerOverview ${coWhere}) + (SELECT COUNT(*) FROM ST_Bookings ${stWhere}) AS total`;
    }

    const [rows, cnt] = await Promise.all([query(rowsSql, { ...coP, ...stP }), query(cntSql, { ...coP, ...stP })]);
    res.json({ rows: rows.recordset || [], total: cnt.recordset[0]?.total || 0, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HOTEL REVIEWS (Paginated) ────────────────────────────────────────────────
router.get('/hotel-reviews', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const off = (page - 1) * limit;
    
    const conds = [], p = {};
    // Filters for the Review Tab
    if (req.query.code) { conds.push('accommodation_code=@code'); p.code = req.query.code; }
    if (req.query.country) { conds.push('reviewer_country=@country'); p.country = req.query.country; }
    if (req.query.minRating) { conds.push('overall_rating>=@min'); p.min = parseFloat(req.query.minRating); }
    
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    
    const [rows, cnt] = await Promise.all([
      query(`
        SELECT 
          id, accommodation_code, accommodation_name, review_date, 
          overall_rating, review_title, review_text, reviewer_name, 
          reviewer_city, reviewer_country, travel_type, language 
        FROM HotelReviews 
        ${where} 
        ORDER BY review_date DESC 
        OFFSET ${off} ROWS FETCH NEXT ${limit} ROWS ONLY`, p),
      query(`SELECT COUNT(*) AS total FROM HotelReviews ${where}`, p)
    ]);

    res.json({ 
      rows: rows.recordset || [], 
      total: cnt.recordset[0]?.total || 0, 
      page, 
      limit 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});