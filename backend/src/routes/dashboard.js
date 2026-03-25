import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function buildWhere(q) {
  const conditions = [];
  const params = {};
  if (q.departureDateFrom) { conditions.push('departure_date >= @depFrom'); params.depFrom = q.departureDateFrom; }
  if (q.departureDateTo)   { conditions.push('departure_date <= @depTo');   params.depTo   = q.departureDateTo;   }
  if (q.bookingDateFrom)   { conditions.push('booking_date >= @bkFrom');    params.bkFrom  = q.bookingDateFrom;   }
  if (q.bookingDateTo)     { conditions.push('booking_date <= @bkTo');      params.bkTo    = q.bookingDateTo;     }
  const datasets = [].concat(q.dataset || []).filter(Boolean);
  if (datasets.length) {
    datasets.forEach((d, i) => { conditions.push(`dataset = @ds${i}`); params[`ds${i}`] = d; });
    // wrap in OR
    const dsConds = datasets.map((_, i) => `dataset = @ds${i}`);
    // remove individual and add grouped
    datasets.forEach((_, i) => { const idx = conditions.indexOf(`dataset = @ds${i}`); if(idx>-1) conditions.splice(idx,1); });
    conditions.push(`(${dsConds.join(' OR ')})`);
  }
  const statuses = [].concat(q.status || []).filter(Boolean);
  if (statuses.length) {
    statuses.forEach((s, i) => { params[`st${i}`] = s; });
    conditions.push(`(${statuses.map((_,i)=>`status = @st${i}`).join(' OR ')})`);
  }
  const transports = [].concat(q.transportType || []).filter(Boolean);
  if (transports.length) {
    transports.forEach((t, i) => { params[`tr${i}`] = t; });
    conditions.push(`(${transports.map((_,i)=>`transport_type = @tr${i}`).join(' OR ')})`);
  }
  return { whereClause: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

// ─── SLICERS ──────────────────────────────────────────────────────────────────
router.get('/slicers', async (req, res) => {
  try {
    const [tr, ds, lb] = await Promise.all([
      query(`SELECT DISTINCT transport_type FROM bookings WHERE transport_type IS NOT NULL ORDER BY transport_type`),
      query(`SELECT DISTINCT dataset FROM bookings WHERE dataset IS NOT NULL ORDER BY dataset`),
      query(`SELECT DISTINCT LabelName FROM CustomerOverview WHERE LabelName IS NOT NULL ORDER BY LabelName`),
    ]);
    res.json({
      transportTypes: [...new Set((tr.recordset||[]).map(r=>r.transport_type).map(t=>(t||'').toLowerCase().replace('owntransport','own transport').trim()))].filter(Boolean),
      datasets: (ds.recordset||[]).map(r=>r.dataset),
      labels: (lb.recordset||[]).map(r=>r.LabelName),
    });
  } catch(err) { res.status(500).json({ error: 'Slicers failed', details: err.message }); }
});

// ─── KPIs ─────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const baseWhere = whereClause || 'WHERE status IN (\'ok\',\'cancelled\')';
    const addAnd = whereClause ? ' AND status IN (\'ok\',\'cancelled\')' : ' AND status IN (\'ok\',\'cancelled\')';
    const result = await query(`
      SELECT
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE()) THEN revenue  ELSE 0 END) AS cr,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())-1 THEN revenue ELSE 0 END) AS pr,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE()) THEN pax     ELSE 0 END) AS cp,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())-1 THEN pax    ELSE 0 END) AS pp,
        COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE()) THEN 1 END)             AS cb,
        COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE())-1 THEN 1 END)           AS pb
      FROM bookings ${whereClause || ''} ${whereClause ? 'AND' : 'WHERE'} status IN ('ok','cancelled')
    `, params);
    const r = result.recordset[0] || {};
    const diffB = (r.cb||0)-(r.pb||0), diffP = (r.cp||0)-(r.pp||0), diffR = (r.cr||0)-(r.pr||0);
    res.json({
      currentBookings: r.cb||0, previousBookings: r.pb||0, differenceBookings: diffB,
      percentBookings: r.pb ? (diffB/r.pb*100) : null,
      currentPax: r.cp||0, previousPax: r.pp||0, differencePax: diffP,
      percentPax: r.pp ? (diffP/r.pp*100) : null,
      currentRevenue: r.cr||0, previousRevenue: r.pr||0, differenceRevenue: diffR,
      percentRevenue: r.pr ? (diffR/r.pr*100) : null,
    });
  } catch(err) { res.status(500).json({ error: 'KPIs failed', details: err.message }); }
});

// ─── REVENUE BY YEAR ──────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT year, month,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      ${whereClause || ''} ${whereClause ? 'AND' : 'WHERE'} status IN ('ok','cancelled')
      AND year BETWEEN 2023 AND 2026
      GROUP BY year, month ORDER BY year, month
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Revenue failed', details: err.message }); }
});

// ─── YEAR-MONTH COMPARISON ────────────────────────────────────────────────────
router.get('/year-month-comparison', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      WITH base AS (
        SELECT year, month,
          COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
        FROM bookings
        ${whereClause || ''} ${whereClause ? 'AND' : 'WHERE'} status IN ('ok','cancelled')
        AND year BETWEEN 2023 AND 2026
        GROUP BY year, month
      )
      SELECT
        a.year, a.month,
        a.bookings AS currentBookings, ISNULL(b.bookings,0) AS previousBookings,
        a.pax      AS currentPax,      ISNULL(b.pax,0)      AS previousPax,
        a.revenue  AS currentRevenue,  ISNULL(b.revenue,0)  AS previousRevenue,
        a.bookings - ISNULL(b.bookings,0) AS diffBookings,
        a.pax      - ISNULL(b.pax,0)      AS diffPax,
        a.revenue  - ISNULL(b.revenue,0)  AS diffRevenue,
        CASE WHEN ISNULL(b.revenue,0)>0 THEN (a.revenue-b.revenue)/b.revenue*100 ELSE NULL END AS diffPct
      FROM base a
      LEFT JOIN base b ON b.year=a.year-1 AND b.month=a.month
      ORDER BY a.year DESC, a.month DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'YoY failed', details: err.message }); }
});

// ─── TRANSPORT BREAKDOWN ──────────────────────────────────────────────────────
router.get('/transport-breakdown', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT transport_type,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      ${whereClause || ''} ${whereClause ? 'AND' : 'WHERE'} status IN ('ok','cancelled')
      GROUP BY transport_type ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Transport failed', details: err.message }); }
});

// ─── BUS CLASS SUMMARY ────────────────────────────────────────────────────────
router.get('/bus-class-summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT bus_type_name AS bus_class, dataset,
        COUNT(*) AS bookings, SUM(pax) AS pax, SUM(revenue) AS revenue
      FROM bookings
      WHERE bus_type_name IS NOT NULL AND bus_type_name NOT IN ('Other','')
      AND status IN ('ok','cancelled')
      GROUP BY bus_type_name, dataset
      ORDER BY bookings DESC
    `);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Bus class failed', details: err.message }); }
});

// ─── BUSTRIPS (PENDEL OVERVIEW) ───────────────────────────────────────────────
router.get('/bustrips', async (req, res) => {
  try {
    const conditions = [];
    const params = {};
    if (req.query.dateFrom) { conditions.push('StartDate >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('EndDate <= @dateTo');     params.dateTo   = req.query.dateTo;   }
    if (req.query.pendel)   { conditions.push('NormalizedPendel = @pendel'); params.pendel = req.query.pendel; }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), StartDate, 103) AS StartDate,
        CONVERT(VARCHAR(10), EndDate,   103) AS EndDate,
        NormalizedPendel,
        SUM(ORC) AS ORC, SUM(OFC) AS OFC, SUM(OPRE) AS OPRE,
        SUM(RRC) AS RRC, SUM(RFC) AS RFC, SUM(RPRE) AS RPRE,
        SUM(OTotal) AS OTotal, SUM(RTotal) AS RTotal,
        SUM(RC_Diff) AS RC_Diff, SUM(FC_Diff) AS FC_Diff,
        SUM(PRE_Diff) AS PRE_Diff, SUM(Total_Difference) AS Total_Difference
      FROM BUStrips ${where}
      GROUP BY StartDate, EndDate, NormalizedPendel
      ORDER BY StartDate DESC, EndDate DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'BUStrips failed', details: err.message }); }
});

// ─── PENDEL OVERVIEW (VW_Solmar_Pendel_Overview) ──────────────────────────────
router.get('/pendel-overview', async (req, res) => {
  try {
    const conditions = ["wayOfTransport = 'bus'"];
    const params = {};
    if (req.query.dateFrom) { conditions.push('dateDeparture >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('dateDeparture <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    if (req.query.label)    { conditions.push('Label = @label');             params.label    = req.query.label;    }
    if (req.query.pendel)   { conditions.push('Pendel = @pendel');           params.pendel   = req.query.pendel;   }
    if (req.query.destination) { conditions.push('Destination = @dest');     params.dest     = req.query.destination; }
    const where = 'WHERE ' + conditions.join(' AND ');
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), dateDeparture, 103) AS dateDeparture,
        CONVERT(VARCHAR(10), dateReturn,    103) AS dateReturn,
        Label, Pendel, Destination, Weekday,
        SUM(Total) AS Total,
        SUM(Total_Lower) AS Total_Lower, SUM(Total_Upper) AS Total_Upper, SUM(Total_NoDeck) AS Total_NoDeck,
        SUM(Royal_Total) AS Royal_Total, SUM(Royal_Lower) AS Royal_Lower, SUM(Royal_Upper) AS Royal_Upper, SUM(Royal_NoDeck) AS Royal_NoDeck,
        SUM(First_Total) AS First_Total, SUM(First_Lower) AS First_Lower, SUM(First_Upper) AS First_Upper, SUM(First_NoDeck) AS First_NoDeck,
        SUM(Premium_Total) AS Premium_Total, SUM(Premium_Lower) AS Premium_Lower, SUM(Premium_Upper) AS Premium_Upper, SUM(Premium_NoDeck) AS Premium_NoDeck
      FROM VW_Solmar_Pendel_Overview ${where}
      GROUP BY dateDeparture, dateReturn, Label, Pendel, Destination, Weekday
      ORDER BY dateDeparture DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Pendel failed', details: err.message }); }
});

// ─── FEEDER OVERVIEW ─────────────────────────────────────────────────────────
router.get('/feeder-overview', async (req, res) => {
  try {
    const conditions = ["wayOfTransport = 'bus'"];
    const params = {};
    if (req.query.dateFrom) { conditions.push('dateDeparture >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('dateDeparture <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    if (req.query.label)    { conditions.push('Label = @label');             params.label    = req.query.label;    }
    if (req.query.departurePlace) { conditions.push('departurePlace = @dp'); params.dp = req.query.departurePlace; }
    const where = 'WHERE ' + conditions.join(' AND ');
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), dateDeparture, 103) AS dateDeparture,
        CONVERT(VARCHAR(10), dateReturn,    103) AS dateReturn,
        departurePlace, wayOfTransport,
        participantBusClass AS busClass,
        participantBusType  AS busType,
        SUM(totalParticipants) AS totalParticipants
      FROM VW_Solmar_Feeder_Overview ${where}
      GROUP BY dateDeparture, dateReturn, departurePlace, wayOfTransport, participantBusClass, participantBusType
      ORDER BY dateDeparture DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Feeder failed', details: err.message }); }
});

// ─── DECK CLASS ───────────────────────────────────────────────────────────────
router.get('/deck-class', async (req, res) => {
  try {
    const conditions = [];
    const params = {};
    if (req.query.dateFrom) { conditions.push('dateDeparture >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conditions.push('dateDeparture <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    if (req.query.label)    { conditions.push('Label = @label');             params.label    = req.query.label;    }
    if (req.query.pendel)   { conditions.push('Pendel = @pendel');           params.pendel   = req.query.pendel;   }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), dateDeparture, 103) AS dateDeparture,
        CONVERT(VARCHAR(10), dateReturn,    103) AS dateReturn,
        Label, Pendel, Destination, Weekday,
        SUM(Total) AS Total,
        SUM(Total_Lower) AS Total_Lower, SUM(Total_Upper) AS Total_Upper, SUM(Total_NoDeck) AS Total_NoDeck,
        SUM(Royal_Total) AS Royal_Total, SUM(Royal_Lower) AS Royal_Lower, SUM(Royal_Upper) AS Royal_Upper, SUM(Royal_NoDeck) AS Royal_NoDeck,
        SUM(First_Total) AS First_Total, SUM(First_Lower) AS First_Lower, SUM(First_Upper) AS First_Upper, SUM(First_NoDeck) AS First_NoDeck,
        SUM(Premium_Total) AS Premium_Total, SUM(Premium_Lower) AS Premium_Lower, SUM(Premium_Upper) AS Premium_Upper, SUM(Premium_NoDeck) AS Premium_NoDeck
      FROM VW_Solmar_Deck_Class ${where}
      GROUP BY dateDeparture, dateReturn, Label, Pendel, Destination, Weekday
      ORDER BY dateDeparture DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Deck class failed', details: err.message }); }
});

// ─── SNOWTRAVEL BUS ───────────────────────────────────────────────────────────
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
        SUM(CASE WHEN bus_type_name='Dream Class'  THEN pax ELSE 0 END) AS dream_class,
        SUM(CASE WHEN bus_type_name='First Class'  THEN pax ELSE 0 END) AS first_class,
        SUM(CASE WHEN bus_type_name LIKE '%Sleep%' OR bus_type_name LIKE '%Royal%' THEN pax ELSE 0 END) AS sleep_royal_class,
        SUM(pax) AS total_pax
      FROM bookings WHERE ${conditions.join(' AND ')}
      GROUP BY departure_date, return_date
      ORDER BY departure_date DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Snowtravel bus failed', details: err.message }); }
});

// ─── DATA TABLE (BOOKINGS) ────────────────────────────────────────────────────
router.get('/bookings-table', async (req, res) => {
  try {
    const conditions = [];
    const params = {};
    if (req.query.dataset)   { conditions.push('Dataset = @dataset');   params.dataset = req.query.dataset; }
    if (req.query.status)    { conditions.push('Status = @status');     params.status  = req.query.status;  }
    if (req.query.depFrom)   { conditions.push('DepartureDate >= @depFrom'); params.depFrom = req.query.depFrom; }
    if (req.query.depTo)     { conditions.push('DepartureDate <= @depTo');   params.depTo   = req.query.depTo;   }
    if (req.query.bkFrom)    { conditions.push('BookingDate >= @bkFrom');    params.bkFrom  = req.query.bkFrom;  }
    if (req.query.bkTo)      { conditions.push('BookingDate <= @bkTo');      params.bkTo    = req.query.bkTo;    }
    if (req.query.search)    {
      conditions.push('(BookingID LIKE @search OR LabelCode LIKE @search)');
      params.search = `%${req.query.search}%`;
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const page = Math.max(1, parseInt(req.query.page)||1);
    const limit = Math.min(200, parseInt(req.query.limit)||50);
    const offset = (page-1)*limit;
    const [rows, cnt] = await Promise.all([
      query(`
        SELECT TOP ${limit}
          BookingID, Dataset, Status, LabelName, LabelCode,
          CONVERT(VARCHAR(10), BookingDate,    103) AS BookingDate,
          CONVERT(VARCHAR(10), DepartureDate,  103) AS DepartureDate,
          CONVERT(VARCHAR(10), ReturnDate,     103) AS ReturnDate,
          PAXCount, TotalRevenue, TransportType,
          BusType, DeparturePlace,
          CustomerCity, CustomerCountry,
          DestinationResort, DepartureYear, DepartureMonth,
          Reseller
        FROM CustomerOverview ${where}
        ORDER BY DepartureDate DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `, params),
      query(`SELECT COUNT(*) AS total FROM CustomerOverview ${where}`, params),
    ]);
    res.json({ rows: rows.recordset||[], total: cnt.recordset[0]?.total||0, page, limit });
  } catch(err) { res.status(500).json({ error: 'Bookings table failed', details: err.message }); }
});

// ─── SNOWTRAVEL DATA TABLE ────────────────────────────────────────────────────
router.get('/snowtravel-table', async (req, res) => {
  try {
    const conditions = ["status IN ('ok','cancelled')"];
    const params = {};
    if (req.query.status)  { conditions[0] = `status = @status`; params.status = req.query.status; }
    if (req.query.depFrom) { conditions.push('dateDeparture >= @depFrom'); params.depFrom = req.query.depFrom; }
    if (req.query.depTo)   { conditions.push('dateDeparture <= @depTo');   params.depTo   = req.query.depTo;   }
    if (req.query.bkFrom)  { conditions.push('creationTime >= @bkFrom');   params.bkFrom  = req.query.bkFrom;  }
    if (req.query.bkTo)    { conditions.push('creationTime <= @bkTo');     params.bkTo    = req.query.bkTo;    }
    if (req.query.search)  { conditions.push('(fileNr LIKE @search OR travelFileId LIKE @search)'); params.search = `%${req.query.search}%`; }
    const where = 'WHERE ' + conditions.join(' AND ');
    const page  = Math.max(1, parseInt(req.query.page)||1);
    const limit = Math.min(200, parseInt(req.query.limit)||50);
    const offset = (page-1)*limit;
    const [rows, cnt] = await Promise.all([
      query(`
        SELECT TOP ${limit}
          travelFileId AS BookingID, fileNr, status AS Status,
          CONVERT(VARCHAR(10), dateDeparture, 103) AS DepartureDate,
          CONVERT(VARCHAR(10), dateReturn,    103) AS ReturnDate,
          CONVERT(VARCHAR(19), creationTime,  103) AS BookingDate,
          paxCount AS PAXCount, totalPrice AS TotalRevenue,
          wayOfTransport AS TransportType,
          busType, busClass, departurePlace AS DeparturePlace,
          packetCode, customerCity AS CustomerCity, customerCountry AS CustomerCountry
        FROM ST_Bookings ${where}
        ORDER BY dateDeparture DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `, params),
      query(`SELECT COUNT(*) AS total FROM ST_Bookings ${where}`, params),
    ]);
    res.json({ rows: rows.recordset||[], total: cnt.recordset[0]?.total||0, page, limit });
  } catch(err) { res.status(500).json({ error: 'Snowtravel table failed', details: err.message }); }
});

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT TOP 50000
        booking_id AS [Booking ID], dataset AS [Dataset], status AS [Status],
        CONVERT(VARCHAR(10), booking_date,    105) AS [Booking Date],
        CONVERT(VARCHAR(10), departure_date,  105) AS [Departure Date],
        CONVERT(VARCHAR(10), return_date,     105) AS [Return Date],
        CAST(year AS VARCHAR) AS [Year],
        LEFT(DATENAME(month, DATEFROMPARTS(year,month,1)),3) AS [Month],
        pax AS [PAX], ROUND(revenue,2) AS [Revenue],
        transport_type AS [Transport], bus_type_name AS [Bus Type],
        destination AS [Destination], region AS [Region],
        customer_country AS [Country]
      FROM bookings ${whereClause}
      ORDER BY departure_date DESC
    `, params);
    const rows = result.recordset||[];
    if (!rows.length) return res.status(200).send('No data');
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(','), ...rows.map(r=>cols.map(c=>{ const v=r[c]??''; const s=String(v); return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:s; }).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment;filename=ttp-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\ufeff'+csv);
  } catch(err) { res.status(500).json({ error: 'Export failed', details: err.message }); }
});

export default router;
