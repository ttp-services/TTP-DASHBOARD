import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

// ─── WHERE BUILDER ────────────────────────────────────────────────────────────
function buildWhere(q) {
  const conds = [], params = {};
  if (q.departureDateFrom) { conds.push('departure_date >= @depFrom'); params.depFrom = q.departureDateFrom; }
  if (q.departureDateTo)   { conds.push('departure_date <= @depTo');   params.depTo   = q.departureDateTo;   }
  if (q.bookingDateFrom)   { conds.push('booking_date >= @bkFrom');    params.bkFrom  = q.bookingDateFrom;   }
  if (q.bookingDateTo)     { conds.push('booking_date <= @bkTo');      params.bkTo    = q.bookingDateTo;     }
  const ds = [].concat(q.dataset || []).filter(Boolean);
  if (ds.length) {
    ds.forEach((d,i) => { params[`ds${i}`] = d; });
    conds.push(`(${ds.map((_,i) => `dataset = @ds${i}`).join(' OR ')})`);
  }
  const st = [].concat(q.status || []).filter(Boolean);
  if (st.length) {
    st.forEach((s,i) => { params[`st${i}`] = s; });
    conds.push(`(${st.map((_,i) => `status = @st${i}`).join(' OR ')})`);
  }
  const tr = [].concat(q.transportType || []).filter(Boolean);
  if (tr.length) {
    tr.forEach((t,i) => { params[`tr${i}`] = t; });
    conds.push(`(${tr.map((_,i) => `transport_type = @tr${i}`).join(' OR ')})`);
  }
  return { whereClause: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params };
}

function andStatus(whereClause) {
  return whereClause
    ? whereClause + " AND status IN ('ok','cancelled')"
    : "WHERE status IN ('ok','cancelled')";
}

// ─── SLICERS ──────────────────────────────────────────────────────────────────
router.get('/slicers', async (req, res) => {
  try {
    const [tr, ds] = await Promise.all([
      query(`SELECT DISTINCT transport_type FROM bookings WHERE transport_type IS NOT NULL AND status IN ('ok','cancelled') ORDER BY transport_type`),
      query(`SELECT DISTINCT dataset FROM bookings WHERE dataset IS NOT NULL ORDER BY dataset`),
    ]);
    // Normalize transport types — deduplicate own transport
    const rawTypes = (tr.recordset||[]).map(r => r.transport_type||'');
    const normTypes = [...new Set(rawTypes.map(t => t.toLowerCase().replace('owntransport','own transport').trim()))].filter(Boolean).sort();
    res.json({
      transportTypes: normTypes,
      datasets: (ds.recordset||[]).map(r => r.dataset),
    });
  } catch(err) { res.status(500).json({ error: 'Slicers failed', details: err.message }); }
});

// ─── KPIs — rolling 12 months current vs previous 12 months ──────────────────
router.get('/kpis', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const hasFilters = whereClause !== '';

    let sql, p;
    if (hasFilters) {
      // Use applied filters — compare current year vs previous year from filtered data
      sql = `
        SELECT
          SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())   THEN revenue ELSE 0 END) AS cr,
          SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())-1 THEN revenue ELSE 0 END) AS pr,
          SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())   THEN pax     ELSE 0 END) AS cp,
          SUM(CASE WHEN year = DATEPART(YEAR,GETDATE())-1 THEN pax     ELSE 0 END) AS pp,
          COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE())   THEN 1 END) AS cb,
          COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE())-1 THEN 1 END) AS pb
        FROM bookings ${andStatus(whereClause)}
      `;
      p = params;
    } else {
      // No filters — rolling 12 months vs previous 12 months
      sql = `
        SELECT
          SUM(CASE WHEN departure_date >= DATEADD(month,-12,GETDATE()) AND departure_date <= GETDATE() THEN revenue ELSE 0 END) AS cr,
          SUM(CASE WHEN departure_date >= DATEADD(month,-24,GETDATE()) AND departure_date < DATEADD(month,-12,GETDATE()) THEN revenue ELSE 0 END) AS pr,
          SUM(CASE WHEN departure_date >= DATEADD(month,-12,GETDATE()) AND departure_date <= GETDATE() THEN pax ELSE 0 END) AS cp,
          SUM(CASE WHEN departure_date >= DATEADD(month,-24,GETDATE()) AND departure_date < DATEADD(month,-12,GETDATE()) THEN pax ELSE 0 END) AS pp,
          COUNT(CASE WHEN departure_date >= DATEADD(month,-12,GETDATE()) AND departure_date <= GETDATE() THEN 1 END) AS cb,
          COUNT(CASE WHEN departure_date >= DATEADD(month,-24,GETDATE()) AND departure_date < DATEADD(month,-12,GETDATE()) THEN 1 END) AS pb
        FROM bookings WHERE status IN ('ok','cancelled')
      `;
      p = {};
    }

    const result = await query(sql, p);
    const r = result.recordset[0] || {};
    const diffB = (r.cb||0)-(r.pb||0);
    const diffP = (r.cp||0)-(r.pp||0);
    const diffR = (r.cr||0)-(r.pr||0);
    res.json({
      currentBookings:  r.cb||0, previousBookings:  r.pb||0,
      differenceBookings: diffB, percentBookings: r.pb ? (diffB/r.pb*100) : null,
      currentPax:       r.cp||0, previousPax:       r.pp||0,
      differencePax:    diffP,   percentPax:    r.pp ? (diffP/r.pp*100) : null,
      currentRevenue:   r.cr||0, previousRevenue:   r.pr||0,
      differenceRevenue: diffR,  percentRevenue: r.pr ? (diffR/r.pr*100) : null,
      periodLabel: hasFilters ? 'filtered' : 'rolling 12 months',
    });
  } catch(err) { res.status(500).json({ error: 'KPIs failed', details: err.message }); }
});

// ─── REVENUE BY YEAR ──────────────────────────────────────────────────────────
router.get('/revenue-by-year', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      SELECT year, month,
        COUNT(*) AS bookings,
        SUM(pax) AS pax,
        SUM(revenue) AS revenue
      FROM bookings
      ${andStatus(whereClause)}
      AND year BETWEEN 2021 AND 2027
      GROUP BY year, month
      ORDER BY year ASC, month ASC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Revenue failed', details: err.message }); }
});

// ─── YEAR-MONTH COMPARISON — proper rolling comparison ────────────────────────
router.get('/year-month-comparison', async (req, res) => {
  try {
    const { whereClause, params } = buildWhere(req.query);
    const result = await query(`
      WITH base AS (
        SELECT year, month,
          COUNT(*) AS bookings,
          SUM(pax) AS pax,
          ROUND(SUM(revenue),2) AS revenue
        FROM bookings
        ${andStatus(whereClause)}
        AND year BETWEEN 2023 AND 2027
        GROUP BY year, month
      )
      SELECT
        a.year, a.month,
        a.bookings  AS currentBookings,  ISNULL(b.bookings,0)  AS previousBookings,
        a.pax       AS currentPax,       ISNULL(b.pax,0)       AS previousPax,
        a.revenue   AS currentRevenue,   ISNULL(b.revenue,0)   AS previousRevenue,
        a.bookings  - ISNULL(b.bookings,0) AS diffBookings,
        a.pax       - ISNULL(b.pax,0)      AS diffPax,
        a.revenue   - ISNULL(b.revenue,0)  AS diffRevenue,
        CASE WHEN ISNULL(b.bookings,0) > 0
             THEN ROUND((CAST(a.bookings AS FLOAT) - b.bookings) / b.bookings * 100, 1)
             ELSE NULL END AS diffPctBookings,
        CASE WHEN ISNULL(b.pax,0) > 0
             THEN ROUND((CAST(a.pax AS FLOAT) - b.pax) / b.pax * 100, 1)
             ELSE NULL END AS diffPctPax,
        CASE WHEN ISNULL(b.revenue,0) > 0
             THEN ROUND((a.revenue - b.revenue) / b.revenue * 100, 1)
             ELSE NULL END AS diffPctRevenue
      FROM base a
      LEFT JOIN base b ON b.year = a.year - 1 AND b.month = a.month
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
      SELECT
        LOWER(REPLACE(transport_type,'ownTransport','own transport')) AS transport_type,
        COUNT(*) AS bookings,
        SUM(pax) AS pax,
        SUM(revenue) AS revenue
      FROM bookings
      ${andStatus(whereClause)}
      GROUP BY LOWER(REPLACE(transport_type,'ownTransport','own transport'))
      ORDER BY bookings DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Transport failed', details: err.message }); }
});

// ─── BUS CLASS SUMMARY ────────────────────────────────────────────────────────
router.get('/bus-class-summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT bus_type_name AS bus_class, dataset,
        COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),2) AS revenue
      FROM bookings
      WHERE bus_type_name IS NOT NULL AND bus_type_name NOT IN ('Other','')
        AND status IN ('ok','cancelled')
      GROUP BY bus_type_name, dataset
      ORDER BY bookings DESC
    `);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Bus class failed', details: err.message }); }
});

// ─── BUSTRIPS (PENDEL OVERVIEW from BUStrips table) ───────────────────────────
router.get('/bustrips', async (req, res) => {
  try {
    const conds = [], params = {};
    if (req.query.dateFrom) { conds.push('StartDate >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conds.push('EndDate <= @dateTo');     params.dateTo   = req.query.dateTo;   }
    if (req.query.pendel)   { conds.push('NormalizedPendel = @pendel'); params.pendel = req.query.pendel; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), StartDate, 103) AS StartDate,
        CONVERT(VARCHAR(10), EndDate,   103) AS EndDate,
        NormalizedPendel,
        SUM(ORC)  AS ORC,  SUM(OFC)  AS OFC,  SUM(OPRE)  AS OPRE,
        SUM(RRC)  AS RRC,  SUM(RFC)  AS RFC,  SUM(RPRE)  AS RPRE,
        SUM(OTotal) AS OTotal, SUM(RTotal) AS RTotal,
        SUM(RC_Diff)  AS RC_Diff,  SUM(FC_Diff)  AS FC_Diff,
        SUM(PRE_Diff) AS PRE_Diff, SUM(Total_Difference) AS Total_Difference
      FROM BUStrips ${where}
      GROUP BY StartDate, EndDate
      ORDER BY StartDate DESC, EndDate DESC, NormalizedPendel ASC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'BUStrips failed', details: err.message }); }
});

// ─── PENDEL OVERVIEW (VW_Solmar_Pendel_Overview) ──────────────────────────────
router.get('/pendel-overview', async (req, res) => {
  try {
    const conds = [];
    const params = {};
    if (req.query.dateFrom)    { conds.push('dateDeparture >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)      { conds.push('dateDeparture <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    if (req.query.label)       { conds.push('Label = @label');             params.label    = req.query.label;    }
    if (req.query.pendel)      { conds.push('Pendel = @pendel');           params.pendel   = req.query.pendel;   }
    if (req.query.destination) { conds.push('Destination = @dest');        params.dest     = req.query.destination; }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), dateDeparture, 103) AS dateDeparture,
        CONVERT(VARCHAR(10), dateReturn,    103) AS dateReturn,
        Label, Pendel, Destination, Weekday,
        SUM(Total)         AS Total,
        SUM(Total_Lower)   AS Total_Lower,   SUM(Total_Upper)   AS Total_Upper,   SUM(Total_NoDeck)   AS Total_NoDeck,
        SUM(Royal_Total)   AS Royal_Total,   SUM(Royal_Lower)   AS Royal_Lower,   SUM(Royal_Upper)    AS Royal_Upper,   SUM(Royal_NoDeck)   AS Royal_NoDeck,
        SUM(First_Total)   AS First_Total,   SUM(First_Lower)   AS First_Lower,   SUM(First_Upper)    AS First_Upper,   SUM(First_NoDeck)   AS First_NoDeck,
        SUM(Premium_Total) AS Premium_Total, SUM(Premium_Lower) AS Premium_Lower, SUM(Premium_Upper)  AS Premium_Upper, SUM(Premium_NoDeck) AS Premium_NoDeck
      FROM VW_Solmar_Pendel_Overview ${where}
      GROUP BY dateDeparture, dateReturn, Label, Pendel, Destination, Weekday
      ORDER BY dateDeparture DESC, Pendel ASC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Pendel failed', details: err.message }); }
});

// ─── FEEDER OVERVIEW (real FeederOverview table) ──────────────────────────────
router.get('/feeder-overview', async (req, res) => {
  try {
    const conds = [];
    const params = {};
    if (req.query.dateFrom)  { conds.push('DepartureDate >= @dateFrom'); params.dateFrom  = req.query.dateFrom; }
    if (req.query.dateTo)    { conds.push('DepartureDate <= @dateTo');   params.dateTo    = req.query.dateTo;   }
    if (req.query.direction) { conds.push('Direction = @direction');     params.direction = req.query.direction;}
    const labels = [].concat(req.query.label || []).filter(Boolean);
    if (labels.length) {
      labels.forEach((l, i) => { params[`lb${i}`] = l; });
      conds.push(`(${labels.map((_,i) => `LabelName = @lb${i}`).join(' OR ')})`);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), DepartureDate, 103) AS DepartureDate,
        LabelName, FeederLine, Direction,
        RouteNo, RouteLabel, StopCodeNormalized, StopName, StopType,
        SUM(TotalPax) AS TotalPax,
        SUM(BookingCount) AS BookingCount,
        SUM(DistinctRelationCount) AS DistinctRelationCount
      FROM FeederOverview ${where}
      GROUP BY DepartureDate, LabelName, FeederLine, Direction,
               RouteNo, RouteLabel, StopCodeNormalized, StopName, StopType
      ORDER BY DepartureDate ASC, RouteNo ASC, StopName ASC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Feeder failed', details: err.message }); }
});

// ─── DECK CLASS ───────────────────────────────────────────────────────────────
router.get('/deck-class', async (req, res) => {
  try {
    const conds = [], params = {};
    if (req.query.dateFrom) { conds.push('dateDeparture >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conds.push('dateDeparture <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    if (req.query.label)    { conds.push('Label = @label');             params.label    = req.query.label;    }
    if (req.query.pendel)   { conds.push('Pendel = @pendel');           params.pendel   = req.query.pendel;   }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
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
      ORDER BY dateDeparture DESC, Pendel ASC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Deck class failed', details: err.message }); }
});

// ─── SNOWTRAVEL BUS ───────────────────────────────────────────────────────────
router.get('/snowtravel-bus', async (req, res) => {
  try {
    const conds = ["dataset = 'Snowtravel'", "status IN ('ok','cancelled')", "bus_type_name IS NOT NULL", "bus_type_name != 'Other'"];
    const params = {};
    if (req.query.dateFrom) { conds.push('departure_date >= @dateFrom'); params.dateFrom = req.query.dateFrom; }
    if (req.query.dateTo)   { conds.push('departure_date <= @dateTo');   params.dateTo   = req.query.dateTo;   }
    const result = await query(`
      SELECT
        CONVERT(VARCHAR(10), departure_date, 103) AS departure_date,
        CONVERT(VARCHAR(10), return_date,    103) AS return_date,
        SUM(CASE WHEN bus_type_name = 'Dream Class'  THEN pax ELSE 0 END) AS dream_class,
        SUM(CASE WHEN bus_type_name = 'First Class'  THEN pax ELSE 0 END) AS first_class,
        SUM(CASE WHEN bus_type_name LIKE '%Sleep%' OR bus_type_name LIKE '%Royal%' THEN pax ELSE 0 END) AS sleep_royal_class,
        SUM(pax) AS total_pax
      FROM bookings WHERE ${conds.join(' AND ')}
      GROUP BY departure_date, return_date
      ORDER BY departure_date DESC
    `, params);
    res.json(result.recordset || []);
  } catch(err) { res.status(500).json({ error: 'Snowtravel bus failed', details: err.message }); }
});

// ─── DATA TABLE — real bookings with all fields ───────────────────────────────
router.get('/bookings-table', async (req, res) => {
  try {
    const conds = ["Status IN ('ok','cancelled')"];
    const params = {};
    if (req.query.dataset)  { conds.push('Dataset = @dataset');             params.dataset = req.query.dataset; }
    if (req.query.status)   { conds[0] = 'Status = @status';               params.status  = req.query.status;  }
    if (req.query.depFrom)  { conds.push('DepartureDate >= @depFrom');      params.depFrom = req.query.depFrom; }
    if (req.query.depTo)    { conds.push('DepartureDate <= @depTo');        params.depTo   = req.query.depTo;   }
    if (req.query.bkFrom)   { conds.push('CAST(BookingDate AS DATE) >= @bkFrom'); params.bkFrom = req.query.bkFrom; }
    if (req.query.bkTo)     { conds.push('CAST(BookingDate AS DATE) <= @bkTo');   params.bkTo   = req.query.bkTo;   }
    if (req.query.search)   {
      conds.push('(BookingID LIKE @search OR LabelCode LIKE @search OR LabelName LIKE @search)');
      params.search = `%${req.query.search}%`;
    }
    const where = 'WHERE ' + conds.join(' AND ');
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const [rows, cnt] = await Promise.all([
      query(`
        SELECT
          BookingID,
          Dataset,
          Status,
          LabelName                                             AS Label,
          LabelCode,
          CONVERT(VARCHAR(10), BookingDate,   103)              AS BookingDate,
          CONVERT(VARCHAR(10), DepartureDate, 103)              AS DepartureDate,
          CONVERT(VARCHAR(10), ReturnDate,    103)              AS ReturnDate,
          DATEDIFF(day, DepartureDate, ReturnDate)              AS Duration,
          PAXCount,
          ROUND(TotalRevenue, 2)                                AS TotalRevenue,
          ROUND(CASE WHEN PAXCount > 0 THEN TotalRevenue / PAXCount ELSE 0 END, 2) AS RevenuePerPax,
          TransportType,
          BusType,
          DeparturePlace,
          CustomerCity                                          AS City,
          CustomerCountry                                       AS Country,
          DestinationResort                                     AS Destination,
          DepartureYear                                         AS Year,
          DepartureMonth                                        AS Month,
          Reseller
        FROM CustomerOverview
        ${where}
        ORDER BY DepartureDate DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `, params),
      query(`SELECT COUNT(*) AS total FROM CustomerOverview ${where}`, params),
    ]);

    res.json({
      rows:  rows.recordset  || [],
      total: cnt.recordset[0]?.total || 0,
      page,
      limit,
    });
  } catch(err) { res.status(500).json({ error: 'Bookings table failed', details: err.message }); }
});

// ─── SNOWTRAVEL DATA TABLE ────────────────────────────────────────────────────
router.get('/snowtravel-table', async (req, res) => {
  try {
    const conds = ["status IN ('ok','cancelled')"];
    const params = {};
    if (req.query.status)  { conds[0] = 'status = @status';                params.status  = req.query.status;  }
    if (req.query.depFrom) { conds.push('dateDeparture >= @depFrom');       params.depFrom = req.query.depFrom; }
    if (req.query.depTo)   { conds.push('dateDeparture <= @depTo');         params.depTo   = req.query.depTo;   }
    if (req.query.bkFrom)  { conds.push('CAST(creationTime AS DATE) >= @bkFrom'); params.bkFrom = req.query.bkFrom; }
    if (req.query.bkTo)    { conds.push('CAST(creationTime AS DATE) <= @bkTo');   params.bkTo   = req.query.bkTo;   }
    if (req.query.search)  {
      conds.push('(fileNr LIKE @search OR travelFileId LIKE @search)');
      params.search = `%${req.query.search}%`;
    }
    const where  = 'WHERE ' + conds.join(' AND ');
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const [rows, cnt] = await Promise.all([
      query(`
        SELECT
          travelFileId AS BookingID, fileNr AS LabelCode,
          'Snowtravel'                                           AS Dataset,
          status                                                 AS Status,
          CONVERT(VARCHAR(10), creationTime, 103)                AS BookingDate,
          CONVERT(VARCHAR(10), dateDeparture, 103)               AS DepartureDate,
          CONVERT(VARCHAR(10), dateReturn,    103)               AS ReturnDate,
          DATEDIFF(day, dateDeparture, dateReturn)               AS Duration,
          paxCount                                               AS PAXCount,
          ROUND(totalPrice, 2)                                   AS TotalRevenue,
          ROUND(CASE WHEN paxCount > 0 THEN totalPrice / paxCount ELSE 0 END, 2) AS RevenuePerPax,
          wayOfTransport                                         AS TransportType,
          busType                                                AS BusType,
          departurePlace                                         AS DeparturePlace,
          customerCity                                           AS City,
          customerCountry                                        AS Country,
          residence                                              AS Destination,
          YEAR(dateDeparture)                                    AS Year,
          MONTH(dateDeparture)                                   AS Month
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
      SELECT TOP 100000
        booking_id                                              AS [Booking ID],
        dataset                                                 AS [Dataset],
        status                                                  AS [Status],
        CONVERT(VARCHAR(10), booking_date,   105)              AS [Booking Date],
        CONVERT(VARCHAR(10), departure_date, 105)              AS [Departure Date],
        CONVERT(VARCHAR(10), return_date,    105)              AS [Return Date],
        DATEDIFF(day, departure_date, return_date)              AS [Duration Days],
        pax                                                     AS [PAX],
        ROUND(revenue, 2)                                       AS [Revenue EUR],
        ROUND(CASE WHEN pax > 0 THEN revenue/pax ELSE 0 END,2) AS [Revenue per PAX],
        transport_type                                          AS [Transport],
        bus_type_name                                           AS [Bus Class],
        destination                                             AS [Destination],
        region                                                  AS [Region],
        customer_country                                        AS [Country],
        CAST(year AS VARCHAR)                                   AS [Year],
        LEFT(DATENAME(month, DATEFROMPARTS(year,month,1)),3)    AS [Month]
      FROM bookings
      ${andStatus(whereClause)}
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
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
    ].join('\n');

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ttp-export-${date}.csv`);
    res.send('\ufeff' + csv);
  } catch(err) { res.status(500).json({ error: 'Export failed', details: err.message }); }
});

export default router;
