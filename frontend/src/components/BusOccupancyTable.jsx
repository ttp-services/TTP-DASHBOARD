import React, { useMemo } from 'react';
function fmtDate(d) {
  if (!d) return '–';
  return String(d).slice(0, 10);
}

function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  return new Intl.NumberFormat('en-US').format(Math.round(v));
}

// Build table rows from bus-occupancy detail: group by (departure_date, return_date), pivot by bus_type
function buildTableRows(detail) {
  if (!detail?.length) return [];
  const busTypes = ['1', '2', '3'];
  const map = {};
  detail.forEach((r) => {
    const dep = fmtDate(r.departure_date);
    const ret = fmtDate(r.return_date);
    const key = `${dep}|${ret}`;
    if (!map[key]) {
      map[key] = {
        departure_date: dep,
        return_date: ret,
        total_outbound: 0,
        ob_1: 0,
        ob_2: 0,
        ob_3: 0,
        total_inbound: 0,
        ib_1: 0,
        ib_2: 0,
        ib_3: 0,
      };
    }
    const bt = String(r.bus_type || '').trim() || 'other';
    const pax = Number(r.pax) || 0;
    map[key].total_outbound += pax;
    map[key].total_inbound += pax;
    if (bt === '1') {
      map[key].ob_1 += pax;
      map[key].ib_1 += pax;
    } else if (bt === '2') {
      map[key].ob_2 += pax;
      map[key].ib_2 += pax;
    } else if (bt === '3') {
      map[key].ob_3 += pax;
      map[key].ib_3 += pax;
    }
  });
  return Object.values(map)
    .map((row) => ({
      ...row,
      diff_1: row.ob_1 - row.ib_1,
      diff_2: row.ob_2 - row.ib_2,
      diff_3: row.ob_3 - row.ib_3,
    }))
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date) || a.return_date.localeCompare(b.return_date));
}

function DiffCell({ value }) {
  const v = Number(value);
  if (!Number.isFinite(v)) return <td className="td-diff">–</td>;
  const cls = v > 10 ? 'neg' : v < -10 ? 'neg' : 'pos';
  return (
    <td className={`td-diff ${cls}`}>
      {v >= 0 ? '+' : ''}
      {fmtNum(v)}
    </td>
  );
}

export function BusOccupancyTable({ data, transportType }) {
  const rows = useMemo(() => buildTableRows(data?.detail), [data?.detail]);
  const isBusOnly = transportType && String(transportType).toLowerCase().includes('bus');

  if (!data?.detail?.length) {
    return (
      <div className="empty-state">
        <span>No bus occupancy data. Apply filters and select a bus transport type.</span>
      </div>
    );
  }

  return (
    <div className="view-content">
      {!isBusOnly && (
        <div className="banner" style={{ background: 'var(--amber-dim)', borderColor: 'var(--amber)', color: 'var(--amber)' }}>
          Filter by transport type (bus) for bus-type breakdown.
        </div>
      )}
      <section className="section">
        <div className="section-header">
          <h2>Bus occupancy by departure & return date</h2>
          <span className="section-badge">PAX by bus type · Outbound vs Inbound</span>
        </div>
        <div className="table-wrap bus-occupancy-table-wrap">
          <table className="data-table bus-occupancy-table">
            <thead>
              <tr>
                <th>Departure Date</th>
                <th>Total</th>
                <th>Outbound BT1</th>
                <th>Outbound BT2</th>
                <th>Outbound BT3</th>
                <th>Return Date</th>
                <th>Total</th>
                <th>Inbound BT1</th>
                <th>Inbound BT2</th>
                <th>Inbound BT3</th>
                <th>Diff BT1</th>
                <th>Diff BT2</th>
                <th>Diff BT3</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="td-month">{row.departure_date}</td>
                  <td>{fmtNum(row.total_outbound)}</td>
                  <td>{fmtNum(row.ob_1)}</td>
                  <td>{fmtNum(row.ob_2)}</td>
                  <td>{fmtNum(row.ob_3)}</td>
                  <td className="td-month">{row.return_date}</td>
                  <td>{fmtNum(row.total_inbound)}</td>
                  <td>{fmtNum(row.ib_1)}</td>
                  <td>{fmtNum(row.ib_2)}</td>
                  <td>{fmtNum(row.ib_3)}</td>
                  <DiffCell value={row.diff_1} />
                  <DiffCell value={row.diff_2} />
                  <DiffCell value={row.diff_3} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
