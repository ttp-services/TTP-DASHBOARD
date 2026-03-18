import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function buildWhere(filters) {
  const conditions = [];
  const params = {};

  const statuses = asArray(filters.status).filter(Boolean);
  if (statuses.length) {
    conditions.push(`status IN (${statuses.map((_, i) => `@st${i}`).join(',')})`);
    statuses.forEach((s, i) => { params[`st${i}`] = s; });
  } else {
    conditions.push(`status IN ('ok','cancelled')`);
  }

  const datasets = asArray(filters.dataset).filter(Boolean);
  if (datasets.length) {
    conditions.push(`dataset IN (${datasets.map((_, i) => `@ds${i}`).join(',')})`);
    datasets.forEach((d, i) => { params[`ds${i}`] = d; });
  }

  const tt = asArray(filters.transportType).filter(Boolean);
  if (tt.length) {
    conditions.push(`transport_type IN (${tt.map((_, i) => `@tt${i}`).join(',')})`);
    tt.forEach((t, i) => { params[`tt${i}`] = t; });
  }

  const bt = asArray(filters.busType).filter(Boolean);
  if (bt.length) {
    conditions.push(`bus_type_name IN (${bt.map((_, i) => `@bt${i}`).join(',')})`);
    bt.forEach((t, i) => { params[`bt${i}`] = t; });
  }

  if (filters.departureDateFrom) { conditions.push('departure_date >= @depFrom'); params.depFrom = filters.departureDateFrom; }
  if (filters.departureDateTo)   { conditions.push('departure_date <= @depTo');   params.depTo   = filters.departureDateTo; }
  if (filters.returnDateFrom)    { conditions.push('return_date >= @retFrom');     params.retFrom = filters.returnDateFrom; }
  if (filters.returnDateTo)      { conditions.push('return_date <= @retTo');       params.retTo   = filters.returnDateTo; }
  if (filters.bookingDateFrom)   { conditions.push('booking_date >= @bkFrom');     params.bkFrom  = filters.bookingDateFrom; }
  if (filters.bookingDateTo)     { conditions.push('booking_date <= @bkTo');       params.bkTo    = filters.bookingDateTo; }

  return { whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

router.get('/slicers', async (req, res) => {
  try {
    const [tt, bt, ds] = await Promise.all([
      query(`SELECT DISTINCT transport_type AS value FROM bookings WHERE transport_type IS NOT NULL AND transport_type != '' ORDER BY transport_type`),
      query(`SELECT DISTINCT bus_type_name AS value FROM bookings WHERE bus_type_name IS NOT NULL AND bus_type_name != '' AND bus_type_name != 'Other' ORDER BY bus_type_name`),
      query(`SELECT DISTINCT dataset AS value FROM bookings WHERE dataset IS NOT NULL ORDER BY dataset`),
    ]);
    res.json({
      transportTypes: (tt.recordset || []).map(r => r.value),
      busTypes: (bt.recordset || []).map(r => r.value),
      datasets: (ds.recordset || []).map(r => r.value),
    });
  } catch (err) {
    console.error('Slicers error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/kpis', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())     THEN revenue ELSE 0 END) AS currentRevenue,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE()) - 1 THEN revenue ELSE 0 END) AS previousRevenue,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())     THEN pax     ELSE 0 END) AS currentPax,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE()) - 1 THEN pax     ELSE 0 END) AS previousPax,
        COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE())     THEN 1 END)            AS currentBookings,
        COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE()) - 1 THEN 1 END)            AS previousBookings
      FROM bookings ${whereClause}
    `, params);
    const r = result.recordset?.[0] || {};
    const curr = r.currentRevenue || 0, prev = r.previousRevenue || 0;
    const cp = r.currentPax || 0, pp = r.previousPax || 0;
    const cb = r.currentBookings || 0, pb = r.previousBookings || 0;
    res.json({
      currentRevenue: curr, previousRevenue: prev,
      currentPax: cp, previousPax: pp,
      currentBookings: cb, previousBookings: pb,
      differenceRevenue: curr - prev, differencePax: cp - pp, differenceBookings: cb - pb,
      percentRevenue: prev ? (((curr - prev) / prev) * 100).toFixed(1) : null,
      percentPax: pp ? (((cp - pp) / pp) * 100).toFixed(1) : null,
      percentBookings: pb ? (((cb - pb) / pb) * 100).toFixed(1) : null,
    });
  } catch (err) {
    console.error('KPIs error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/revenue-by-year', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT year, month, SUM(revenue) AS revenue, COUNT(*) AS bookings, SUM(pax) AS pax
      FROM bookings ${whereClause}
      GROUP BY year, month ORDER BY year, month
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/year-month-comparison', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      WITH agg AS (
        SELECT year, month, COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM bookings ${whereClause} GROUP BY year, month
      )
      SELECT f.year, f.month,
        f.bookings AS currentBookings, f.pax AS currentPax, f.revenue AS currentRevenue,
        p.bookings AS previousBookings, p.pax AS previousPax, p.revenue AS previousRevenue,
        f.bookings - ISNULL(p.bookings,0) AS diffBookings,
        f.pax      - ISNULL(p.pax,0)      AS diffPax,
        f.revenue  - ISNULL(p.revenue,0)  AS diffRevenue
      FROM agg f LEFT JOIN agg p ON p.year = f.year - 1 AND p.month = f.month
      ORDER BY f.year, f.month
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/transport-breakdown', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT LOWER(TRIM(transport_type)) AS transport_type,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings ${whereClause}
      AND transport_type IS NOT NULL AND transport_type != ''
      GROUP BY LOWER(TRIM(transport_type))
      ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/departure-places', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT destination, COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings ${whereClause}
      AND destination IS NOT NULL AND destination != ''
      GROUP BY destination ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/bus-class-summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT bus_type_name AS bus_class, dataset,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      WHERE bus_type_name IS NOT NULL AND bus_type_name != 'Other'
        AND bus_type_name != '' AND status IN ('ok','cancelled')
      GROUP BY bus_type_name, dataset ORDER BY bookings DESC
    `);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/bustrips', async (req, res) => {
  try {
    const conditions = [], params = {};
    if (req.query.pendel)   { conditions.push('NormalizedPendel = @pendel'); params.pendel   = req.query.pendel; }
    if (req.query.dateFrom) { conditions.push('StartDate >= @dateFrom');     params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('StartDate <= @dateTo');       params.dateTo   = req.query.dateTo; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [result, pendels] = await Promise.all([
      query(`
        SELECT CONVERT(VARCHAR(10),StartDate,120) AS StartDate, CONVERT(VARCHAR(10),EndDate,120) AS EndDate,
          SUM(ORC) AS ORC, SUM(OFC) AS OFC, SUM(OPRE) AS OPRE,
          SUM(RRC) AS RRC, SUM(RFC) AS RFC, SUM(RPRE) AS RPRE,
          SUM(OTotal) AS OTotal, SUM(RTotal) AS RTotal,
          SUM(RC_Diff) AS RC_Diff, SUM(FC_Diff) AS FC_Diff,
          SUM(PRE_Diff) AS PRE_Diff, SUM(Total_Difference) AS Total_Difference
        FROM BUStrips ${where}
        GROUP BY StartDate, EndDate ORDER BY StartDate DESC
      `, params),
      query(`SELECT DISTINCT NormalizedPendel AS value FROM BUStrips ORDER BY NormalizedPendel`)
    ]);
    res.json({ rows: result.recordset || [], pendels: (pendels.recordset || []).map(r => r.value) });
  } catch (err) {
    console.error('BUStrips error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/snowtravel-bus', async (req, res) => {
  try {
    const conditions = [`dataset = 'Snowtravel'`, `bus_type_name IS NOT NULL`, `bus_type_name != 'Other'`, `status = 'ok'`];
    const params = {};
    if (req.query.dateFrom) { conditions.push('departure_date >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('departure_date <= @dateTo');   params.dateTo   = req.query.dateTo; }
    const result = await query(`
      SELECT CONVERT(VARCHAR(10),departure_date,120) AS departure_date,
        CONVERT(VARCHAR(10),return_date,120) AS return_date,
        SUM(CASE WHEN bus_type_name = 'Dream Class' THEN pax ELSE 0 END) AS dream_class,
        SUM(CASE WHEN bus_type_name = 'First Class' THEN pax ELSE 0 END) AS first_class,
        SUM(CASE WHEN bus_type_name LIKE '%Sleep%' OR bus_type_name LIKE '%Royal%' THEN pax ELSE 0 END) AS sleep_royal,
        SUM(pax) AS total_pax
      FROM bookings WHERE ${conditions.join(' AND ')}
      GROUP BY departure_date, return_date ORDER BY departure_date DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT
        booking_id                                          AS [Booking ID],
        dataset                                             AS [Dataset],
        status                                              AS [Status],
        CONVERT(VARCHAR(10), booking_date, 105)             AS [Booking Date],
        CONVERT(VARCHAR(10), departure_date, 105)           AS [Departure Date],
        CONVERT(VARCHAR(10), return_date, 105)              AS [Return Date],
        CAST(year AS VARCHAR)                               AS [Year],
        LEFT(DATENAME(month, DATEFROMPARTS(year,month,1)),3) AS [Month],
        pax                                                 AS [PAX],
        ROUND(revenue, 2)                                   AS [Revenue],
        bus_type_name                                       AS [Bus Type],
        packet_code                                         AS [Packet Code],
        destination                                         AS [Destination],
        transport_type                                      AS [Transport Type],
        customer_country                                    AS [Country],
        region                                              AS [Region]
      FROM bookings
      ${whereClause}
      ORDER BY booking_date DESC
    `, params);
    const rows = result.recordset || [];
    if (!rows.length) return res.status(200).send('No data found');
    const cols = Object.keys(rows[0]);
    const csv = [
      cols.join(','),
      ...rows.map(r => cols.map(c => {
        const v = r[c] ?? '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ttp-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\ufeff' + csv);
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

router.get('/snowtravel-monthly', async (req, res) => {
  try {
    const conditions = ["dataset = 'Snowtravel'", "status = 'ok'", "bus_type_name IS NOT NULL", "bus_type_name != 'Other'"];
    const params = {};
    if (req.query.dateFrom) { conditions.push('departure_date >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo) { conditions.push('departure_date <= @dateTo'); params.dateTo = req.query.dateTo; }
    const result = await query(`
      SELECT year, month, bus_type_name AS bus_class,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings WHERE ${conditions.join(' AND ')}
      GROUP BY year, month, bus_type_name
      ORDER BY year, month, bus_type_name
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

export default router;

