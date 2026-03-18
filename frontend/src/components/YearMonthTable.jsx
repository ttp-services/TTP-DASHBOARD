import React from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  return new Intl.NumberFormat('en-US').format(Math.round(v));
}

function fmtEuro(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(1)}K`;
  return `€${new Intl.NumberFormat('en-US').format(Math.round(v))}`;
}

function DiffCell({ cur, prev, isCurrency }) {
  const c = Number(cur), p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return <td className="td-diff">–</td>;
  const diff = c - p;
  const cls = diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'neu';
  const fmt = isCurrency ? fmtEuro : fmtNum;
  return <td className={`td-diff ${cls}`}>{diff > 0 ? '+' : ''}{fmt(diff)}</td>;
}

export function YearMonthTable({ data, metric }) {
  if (!data?.length) return (
    <div className="empty-state">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="2" stroke="var(--text-muted)" strokeWidth="1.5" opacity=".4"/><path d="M4 10h24M10 10v18" stroke="var(--text-muted)" strokeWidth="1.5" opacity=".4"/></svg>
      <span>No comparison data — connect Azure SQL.</span>
    </div>
  );

  // Calculate totals
  const totals = data.reduce((acc, row) => ({
    currentBookings:  (acc.currentBookings  || 0) + (Number(row.currentBookings)  || 0),
    previousBookings: (acc.previousBookings || 0) + (Number(row.previousBookings) || 0),
    currentPax:       (acc.currentPax       || 0) + (Number(row.currentPax)       || 0),
    previousPax:      (acc.previousPax      || 0) + (Number(row.previousPax)      || 0),
    currentRevenue:   (acc.currentRevenue   || 0) + (Number(row.currentRevenue)   || 0),
    previousRevenue:  (acc.previousRevenue  || 0) + (Number(row.previousRevenue)  || 0),
  }), {});

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Month</th>
            <th className={metric === 'bookings' ? 'col-active' : ''}>Bookings (Cur)</th>
            <th className={metric === 'bookings' ? 'col-active' : ''}>Bookings (Prev)</th>
            <th className={metric === 'bookings' ? 'col-active' : ''}>Diff</th>
            <th className={metric === 'pax' ? 'col-active' : ''}>PAX (Cur)</th>
            <th className={metric === 'pax' ? 'col-active' : ''}>PAX (Prev)</th>
            <th className={metric === 'pax' ? 'col-active' : ''}>Diff</th>
            <th className={metric === 'turnover' ? 'col-active' : ''}>Turnover (Cur)</th>
            <th className={metric === 'turnover' ? 'col-active' : ''}>Turnover (Prev)</th>
            <th className={metric === 'turnover' ? 'col-active' : ''}>Diff</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="td-month">{MONTHS[(row.month ?? 1) - 1]} {row.year}</td>
              <td className={metric === 'bookings' ? 'col-active' : ''}>{fmtNum(row.currentBookings)}</td>
              <td className={`td-prev ${metric === 'bookings' ? 'col-active' : ''}`}>{fmtNum(row.previousBookings)}</td>
              <DiffCell cur={row.currentBookings} prev={row.previousBookings} />
              <td className={metric === 'pax' ? 'col-active' : ''}>{fmtNum(row.currentPax)}</td>
              <td className={`td-prev ${metric === 'pax' ? 'col-active' : ''}`}>{fmtNum(row.previousPax)}</td>
              <DiffCell cur={row.currentPax} prev={row.previousPax} />
              <td className={metric === 'turnover' ? 'col-active' : ''}>{fmtEuro(row.currentRevenue)}</td>
              <td className={`td-prev ${metric === 'turnover' ? 'col-active' : ''}`}>{fmtEuro(row.previousRevenue)}</td>
              <DiffCell cur={row.currentRevenue} prev={row.previousRevenue} isCurrency />
            </tr>
          ))}
        </tbody>
        {/* Totals row */}
        <tfoot>
          <tr className="totals-row">
            <td className="td-month">TOTAL</td>
            <td className={metric === 'bookings' ? 'col-active' : ''}>{fmtNum(totals.currentBookings)}</td>
            <td className={`td-prev ${metric === 'bookings' ? 'col-active' : ''}`}>{fmtNum(totals.previousBookings)}</td>
            <DiffCell cur={totals.currentBookings} prev={totals.previousBookings} />
            <td className={metric === 'pax' ? 'col-active' : ''}>{fmtNum(totals.currentPax)}</td>
            <td className={`td-prev ${metric === 'pax' ? 'col-active' : ''}`}>{fmtNum(totals.previousPax)}</td>
            <DiffCell cur={totals.currentPax} prev={totals.previousPax} />
            <td className={metric === 'turnover' ? 'col-active' : ''}>{fmtEuro(totals.currentRevenue)}</td>
            <td className={`td-prev ${metric === 'turnover' ? 'col-active' : ''}`}>{fmtEuro(totals.previousRevenue)}</td>
            <DiffCell cur={totals.currentRevenue} prev={totals.previousRevenue} isCurrency />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
