import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { BUS_LABELS, BUS_COLORS } from '../utils/constants';

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

function fmtDate(d) {
  if (!d) return '–';
  return String(d).slice(0, 10);
}

function busLabel(t) { return BUS_LABELS[t ?? ''] ?? 'Own Transport'; }
function busColor(t) { return BUS_COLORS[t ?? ''] ?? '#7d8590'; }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="ct-row">
          <span className="ct-dot" style={{ background: p.fill ?? p.color }} />
          <span className="ct-key">{p.name}</span>
          <span className="ct-val">{typeof p.value === 'number' && p.name?.includes('€')
            ? fmtEuro(p.value) : fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function BusBarChart({ summary }) {
  const data = useMemo(() => {
    if (!summary?.length) return [];
    return summary.map((r) => ({
      name: busLabel(r.bus_type),
      PAX: Number(r.pax) || 0,
      Bookings: Number(r.bookings) || 0,
      busType: r.bus_type ?? '',
    })).sort((a, b) => b.PAX - a.PAX);
  }, [summary]);

  if (!data.length) return <div className="empty-state"><span>No data.</span></div>;

  return (
    <div className="occ-charts">
      {/* PAX bar */}
      <div className="occ-chart-wrap">
        <div className="occ-chart-title">Total PAX by Bus Type</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} width={44} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="PAX" radius={[6,6,0,0]} maxBarSize={72}>
              {data.map((d, i) => <Cell key={i} fill={busColor(d.busType)} />)}
              <LabelList dataKey="PAX" position="top"
                formatter={(v) => fmtNum(v)}
                style={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bookings bar */}
      <div className="occ-chart-wrap">
        <div className="occ-chart-title">Bookings by Bus Type</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Bookings" radius={[6,6,0,0]} maxBarSize={72}>
              {data.map((d, i) => <Cell key={i} fill={busColor(d.busType)} opacity={0.7} />)}
              <LabelList dataKey="Bookings" position="top"
                formatter={(v) => fmtNum(v)}
                style={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      <div className="occ-summary">
        {data.map((row) => {
          const avg = row.Bookings ? Math.round(row.PAX / row.Bookings) : 0;
          return (
            <div key={row.name} className="occ-card">
              <div className="occ-card-header">
                <span className="occ-dot" style={{ background: busColor(row.busType) }} />
                <span className="occ-card-name">{row.name}</span>
              </div>
              <div className="occ-card-val">{fmtNum(row.PAX)}</div>
              <div className="occ-card-sub">PAX total</div>
              <div className="occ-card-meta">
                <span>{fmtNum(row.Bookings)} bookings</span>
                <span>avg {avg} PAX/booking</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BusDetailTable({ detail }) {
  const rows = useMemo(() => {
    if (!detail?.length) return [];
    // Group by departure_date + return_date, show outbound vs inbound bus type
    const map = {};
    detail.forEach((r) => {
      const dep = fmtDate(r.departure_date);
      const ret = fmtDate(r.return_date);
      const key = `${dep}__${ret}`;
      if (!map[key]) map[key] = {
        departure_date: dep,
        return_date: ret,
        outbound_bus: r.bus_type ?? '',
        inbound_bus: r.bus_type ?? '',
        pax: 0, bookings: 0, revenue: 0,
        prev_pax: 0,
      };
      map[key].pax      += Number(r.pax)      || 0;
      map[key].bookings += Number(r.bookings)  || 0;
      map[key].revenue  += Number(r.revenue)   || 0;
    });

    const arr = Object.values(map).sort((a, b) => a.departure_date.localeCompare(b.departure_date));

    // Calculate diff vs previous row
    return arr.map((row, i) => ({
      ...row,
      pax_diff: i > 0 ? row.pax - arr[i-1].pax : null,
    }));
  }, [detail]);

  if (!rows.length) return (
    <div className="empty-state"><span>No bus detail data.</span></div>
  );

  const totals = rows.reduce((acc, r) => ({
    pax:      acc.pax      + r.pax,
    bookings: acc.bookings + r.bookings,
    revenue:  acc.revenue  + r.revenue,
  }), { pax: 0, bookings: 0, revenue: 0 });

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Departure Date</th>
            <th>Outbound Bus</th>
            <th>Return Date</th>
            <th>Inbound Bus</th>
            <th>Bookings</th>
            <th>PAX</th>
            <th>PAX Diff</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const diffCls = row.pax_diff === null ? '' : row.pax_diff > 0 ? 'pos' : row.pax_diff < 0 ? 'neg' : 'neu';
            return (
              <tr key={i}>
                <td className="td-month">{row.departure_date}</td>
                <td>
                  <span className="bus-badge"
                    style={{ background: busColor(row.outbound_bus) + '22', color: busColor(row.outbound_bus) }}>
                    {busLabel(row.outbound_bus)}
                  </span>
                </td>
                <td className="td-month">{row.return_date}</td>
                <td>
                  <span className="bus-badge"
                    style={{ background: busColor(row.inbound_bus) + '22', color: busColor(row.inbound_bus) }}>
                    {busLabel(row.inbound_bus)}
                  </span>
                </td>
                <td>{fmtNum(row.bookings)}</td>
                <td style={{ fontWeight: 600 }}>{fmtNum(row.pax)}</td>
                <td className={`td-diff ${diffCls}`}>
                  {row.pax_diff === null ? '–' : (row.pax_diff >= 0 ? '+' : '') + fmtNum(row.pax_diff)}
                </td>
                <td>{fmtEuro(row.revenue)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td className="td-month" colSpan={4}>TOTAL</td>
            <td>{fmtNum(totals.bookings)}</td>
            <td style={{ fontWeight: 600 }}>{fmtNum(totals.pax)}</td>
            <td>–</td>
            <td>{fmtEuro(totals.revenue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function BusOccupancyView({ data }) {
  return (
    <div className="view-content">
      <section className="section">
        <div className="section-header">
          <h2>Bus Occupancy Overview</h2>
          <span className="section-badge">PAX & Bookings by Bus Type</span>
        </div>
        <BusBarChart summary={data?.summary} />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Bus Occupancy Detail</h2>
          <span className="section-badge">Outbound & Inbound by Date</span>
        </div>
        <BusDetailTable detail={data?.detail} />
      </section>
    </div>
  );
}
