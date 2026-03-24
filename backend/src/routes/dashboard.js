import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

// ── HELPERS ──────────────────────────────────────────────────────────────────
function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function buildWhere(filters = {}) {
  const conditions = [];
  const params = {};

  const datasets = asArray(filters.dataset).filter(Boolean);
  if (datasets.length) {
    conditions.push(`dataset IN (${datasets.map((_, i) => `@ds${i}`).join(',')})`);
    datasets.forEach((d, i) => { params[`ds${i}`] = d; });
  }

  const statuses = asArray(filters.status).filter(Boolean);
  if (statuses.length) {
    conditions.push(`status IN (${statuses.map((_, i) => `@st${i}`).join(',')})`);
    statuses.forEach((s, i) => { params[`st${i}`] = s; });
  } else {
    conditions.push(`status IN ('ok','cancelled')`);
  }

  const transports = asArray(filters.transportType).filter(Boolean);
  if (transports.length) {
    conditions.push(`transport_type IN (${transports.map((_, i) => `@tr${i}`).join(',')})`);
    transports.forEach((t, i) => { params[`tr${i}`] = t; });
  }

  const busTypes = asArray(filters.busType).filter(Boolean);
  if (busTypes.length) {
    conditions.push(`bus_type_name IN (${busTypes.map((_, i) => `@bt${i}`).join(',')})`);
    busTypes.forEach((b, i) => { params[`bt${i}`] = b; });
  }

  if (filters.departureDateFrom) { conditions.push('departure_date >= @ddFrom'); params.ddFrom = filters.departureDateFrom; }
  if (filters.departureDateTo)   { conditions.push('departure_date <= @ddTo');   params.ddTo   = filters.departureDateTo;   }
  if (filters.bookingDateFrom)   { conditions.push('booking_date >= @bdFrom');   params.bdFrom = filters.bookingDateFrom;   }
  if (filters.bookingDateTo)     { conditions.push('booking_date <= @bdTo');     params.bdTo   = filters.bookingDateTo;     }

  return {
    whereClause: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    params
  };
}

// ── SLICERS ───────────────────────────────────────────────────────────────────
router.get('/slicers', async (req, res) => {
  try {
    const [tr, bt, ds] = await Promise.all([
      query(`SELECT DISTINCT ISNULL(transport_type,'Unknown') AS val FROM bookings WHERE status IN ('ok','cancelled') AND transport_type IS NOT NULL ORDER BY val`),
      query(`SELECT DISTINCT ISNULL(bus_type_name,'Unknown') AS val FROM bookings WHERE status IN ('ok','cancelled') AND bus_type_name IS NOT NULL AND bus_type_name != 'Other' ORDER BY val`),
      query(`SELECT DISTINCT dataset AS val FROM bookings WHERE status IN ('ok','cancelled') ORDER BY val`),
    ]);
    res.json({
      transportTypes: tr.recordset.map(r => r.val),
      busTypes: bt.recordset.map(r => r.val),
      datasets: ds.recordset.map(r => r.val),
    });
  } catch (err) {
    console.error('Slicers error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── KPIs ──────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);

    const hasDateFilter = req.query.departureDateFrom || req.query.departureDateTo || req.query.bookingDateFrom || req.query.bookingDateTo;
    const cy = new Date().getFullYear();
    const py = cy - 1;

    // Current period
    const result = await query(`
      SELECT
        COUNT(*)               AS currentBookings,
        SUM(pax)               AS currentPax,
        ROUND(SUM(revenue), 2) AS currentRevenue
      FROM bookings
      ${whereClause}
    `, params);

    // Previous period - shift dates back 1 year if date filter applied, else use previous year
    const prevParams = { ...params };
    let prevWhere = whereClause;

    if (hasDateFilter) {
      if (prevParams.ddFrom) { const d = new Date(prevParams.ddFrom); d.setFullYear(d.getFullYear()-1); prevParams.ddFrom = d.toISOString().split('T')[0]; }
      if (prevParams.ddTo)   { const d = new Date(prevParams.ddTo);   d.setFullYear(d.getFullYear()-1); prevParams.ddTo   = d.toISOString().split('T')[0]; }
      if (prevParams.bdFrom) { const d = new Date(prevParams.bdFrom); d.setFullYear(d.getFullYear()-1); prevParams.bdFrom = d.toISOString().split('T')[0]; }
      if (prevParams.bdTo)   { const d = new Date(prevParams.bdTo);   d.setFullYear(d.getFullYear()-1); prevParams.bdTo   = d.toISOString().split('T')[0]; }
    } else {
      prevWhere = whereClause ? whereClause + ` AND year = ${py}` : `WHERE year = ${py}`;
    }

    const prevResult = await query(`
      SELECT
        COUNT(*)               AS previousBookings,
        SUM(pax)               AS previousPax,
        ROUND(SUM(revenue), 2) AS previousRevenue
      FROM bookings
      ${prevWhere}
    `, prevParams);

    const r = result.recordset[0] || {};
    const p = prevResult.recordset[0] || {};
    const diff = (a, b) => a - b;
    const pct  = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : null;

    res.json({
      currentBookings:    r.currentBookings   || 0,
      previousBookings:   p.previousBookings  || 0,
      differenceBookings: diff(r.currentBookings || 0, p.previousBookings || 0),
      percentBookings:    pct(r.currentBookings  || 0, p.previousBookings || 0),
      currentPax:         r.currentPax        || 0,
      previousPax:        p.previousPax       || 0,
      differencePax:      diff(r.currentPax || 0, p.previousPax || 0),
      percentPax:         pct(r.currentPax  || 0, p.previousPax || 0),
      currentRevenue:     r.currentRevenue    || 0,
      previousRevenue:    p.previousRevenue   || 0,
      differenceRevenue:  diff(r.currentRevenue || 0, p.previousRevenue || 0),
      percentRevenue:     pct(r.currentRevenue || 0, p.previousRevenue || 0),
    });
  } catch (err) {
    console.error('KPIs error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── REVENUE BY YEAR ───────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT year, month,
        SUM(revenue)  AS revenue,
        COUNT(*)      AS bookings,
        SUM(pax)      AS pax
      FROM bookings
      ${whereClause}
      GROUP BY year, month
      ORDER BY year, month
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Revenue-by-year error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── YEAR-MONTH COMPARISON ─────────────────────────────────────────────────────
router.get('/year-month-comparison', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT
        year,
        month,
        COUNT(*)             AS currentBookings,
        SUM(pax)             AS currentPax,
        ROUND(SUM(revenue),0) AS currentRevenue
      FROM bookings
      ${whereClause}
      GROUP BY year, month
      ORDER BY year DESC, month ASC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('YM comparison error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── TRANSPORT BREAKDOWN ───────────────────────────────────────────────────────
router.get('/transport-breakdown', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT
        ISNULL(LOWER(REPLACE(transport_type,'ownTransport','own transport')), 'unknown') AS transport_type,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      ${whereClause}
      GROUP BY LOWER(REPLACE(transport_type,'ownTransport','own transport'))
      ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Transport error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── DEPARTURE PLACES ──────────────────────────────────────────────────────────
router.get('/departure-places', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT destination, COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      ${whereClause}
      AND destination IS NOT NULL AND destination != ''
      GROUP BY destination
      ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Departure places error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── BUS CLASS SUMMARY ─────────────────────────────────────────────────────────
router.get('/bus-class-summary', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT bus_type_name AS bus_class, dataset,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      ${whereClause}
      AND bus_type_name IS NOT NULL AND bus_type_name != 'Other'
      GROUP BY bus_type_name, dataset
      ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Bus class error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── BUSTRIPS (DISTINCT DATES) ─────────────────────────────────────────────────
router.get('/bustrips', async (req, res) => {
  try {
    const conditions = [];
    const params = {};
    if (req.query.dateFrom) { conditions.push('StartDate >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('EndDate   <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    if (req.query.pendel)   { conditions.push('NormalizedPendel = @pendel'); params.pendel = req.query.pendel; }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), StartDate, 103) AS StartDate,
        CONVERT(VARCHAR(10), EndDate,   103) AS EndDate,
        SUM(ORC)  AS ORC,  SUM(OFC)  AS OFC,  SUM(OPRE)  AS OPRE,
        SUM(RRC)  AS RRC,  SUM(RFC)  AS RFC,  SUM(RPRE)  AS RPRE,
        SUM(OTotal) AS OTotal, SUM(RTotal) AS RTotal,
        SUM(RC_Diff)  AS RC_Diff,  SUM(FC_Diff)  AS FC_Diff,
        SUM(PRE_Diff) AS PRE_Diff, SUM(Total_Difference) AS Total_Difference
      FROM BUStrips ${where}
      GROUP BY StartDate, EndDate
      ORDER BY StartDate DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('BUStrips error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── SNOWTRAVEL BUS OCCUPANCY ──────────────────────────────────────────────────
router.get('/snowtravel-bus', async (req, res) => {
  try {
    const conditions = ["dataset = 'Snowtravel'", "status = 'ok'", "bus_type_name IS NOT NULL", "bus_type_name != 'Other'"];
    const params = {};
    if (req.query.dateFrom) { conditions.push('departure_date >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('departure_date <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), departure_date, 103) AS departure_date,
        CONVERT(VARCHAR(10), return_date,    103) AS return_date,
        SUM(CASE WHEN bus_type_name = 'Dream Class'      THEN pax ELSE 0 END) AS dream_class,
        SUM(CASE WHEN bus_type_name = 'First Class'      THEN pax ELSE 0 END) AS first_class,
        SUM(CASE WHEN bus_type_name LIKE '%Sleep%' OR bus_type_name LIKE '%Royal%' THEN pax ELSE 0 END) AS sleep_royal,
        SUM(pax) AS total_pax
      FROM bookings
      WHERE ${conditions.join(' AND ')}
      GROUP BY departure_date, return_date
      ORDER BY departure_date DESC
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Snowtravel bus error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── SNOWTRAVEL MONTHLY BY BUS TYPE ────────────────────────────────────────────
router.get('/snowtravel-monthly', async (req, res) => {
  try {
    const conditions = ["dataset = 'Snowtravel'", "status = 'ok'", "bus_type_name IS NOT NULL", "bus_type_name != 'Other'"];
    const params = {};
    if (req.query.dateFrom) { conditions.push('departure_date >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('departure_date <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    const result = await query(`
      SELECT year, month, bus_type_name AS bus_class,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      WHERE ${conditions.join(' AND ')}
      GROUP BY year, month, bus_type_name
      ORDER BY year, month, bus_type_name
    `, params);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Snowtravel monthly error:', err.message);
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = (await import('jsonwebtoken')).default;
        jwt.verify(token, process.env.JWT_SECRET || 'ttp-secret-key');
      } catch {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT TOP 100000
        booking_id                                                       AS [Booking ID],
        dataset                                                          AS [Dataset],
        status                                                           AS [Status],
        CONVERT(VARCHAR(10), booking_date,   103)                        AS [Booking Date],
        CONVERT(VARCHAR(10), departure_date, 103)                        AS [Departure Date],
        CONVERT(VARCHAR(10), return_date,    103)                        AS [Return Date],
        CAST(year AS VARCHAR)                                            AS [Year],
        LEFT(DATENAME(month, DATEFROMPARTS(year, month, 1)), 3)          AS [Month],
        pax                                                              AS [PAX],
        ROUND(revenue, 2)                                                AS [Revenue],
        ISNULL(bus_type_name, '')                                        AS [Bus Type],
        ISNULL(packet_code, '')                                          AS [Packet Code],
        ISNULL(destination, '')                                          AS [Destination],
        ISNULL(transport_type, '')                                       AS [Transport Type],
        ISNULL(customer_country, '')                                     AS [Country]
      FROM bookings
      ${whereClause}
      ORDER BY departure_date DESC
    `, params);

    const rows = result.recordset || [];
    if (!rows.length) return res.status(200).send('No data found for selected filters');

    const cols = Object.keys(rows[0]);
    const csv = [
      cols.join(','),
      ...rows.map(r => cols.map(c => {
        const v = r[c] ?? '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
    ].join('\n');

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ttp-export-${date}.csv`);
    res.send('\ufeff' + csv);
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

export default router;