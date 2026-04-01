import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { BUS_LABELS, BUS_COLORS } from '../utils/constants.js';

function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  return new Intl.NumberFormat('en-US').format(Math.round(v));
}

function busLabel(t) { return BUS_LABELS?.[t ?? ''] ?? (t || 'Own Transport'); }
function busColor(t) { return BUS_COLORS?.[t ?? ''] ?? '#4d9eff'; }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="ct-row">
          <span className="ct-dot" style={{ background: p.fill ?? p.color }} />
          <span className="ct-key">{p.name}</span>
          <span className="ct-val">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── KPI strip ──────────────────────────────────────────────────────────────
function BusKpiStrip({ data }) {
  if (!data) return null;
  const kpis = [
    { label: 'Total PAX',       value: fmtNum(data.total_pax),       color: 'var(--blue)'   },
    { label: 'Total Bookings',  value: fmtNum(data.total_bookings),   color: 'var(--green)'  },
    { label: 'Royal Class',     value: fmtNum(data.royal_pax),        color: 'var(--purple)' },
    { label: 'First Class',     value: fmtNum(data.first_pax),        color: 'var(--amber)'  },
    { label: 'Premium Class',   value: fmtNum(data.premium_pax),      color: 'var(--green)'  },
  ];
  return (
    <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
      {kpis.map(k => (
        <div key={k.label} style={{
          flex:'1', minWidth:130,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-lg)', padding:'14px 16px',
        }}>
          <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-dim)', marginBottom:6 }}>
            {k.label}
          </div>
          <div style={{ fontSize:24, fontWeight:700, fontFamily:'var(--mono)', color:k.color }}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Visual Deck / Seat Map ─────────────────────────────────────────────────
function BusSeatMap({ data }) {
  const lower = Number(data?.lower_pax) || 0;
  const upper = Number(data?.upper_pax) || 0;
  const total = Number(data?.total_pax) || 0;
  const noGuarantee = total - lower - upper;
  const maxVal = Math.max(lower, upper, noGuarantee, 1);

  const pct = (v) => Math.max(8, Math.round((v / maxVal) * 100));

  const decks = [
    { key: 'upper',       label: 'Upper Deck',    value: upper,       cls: 'upper',       color: 'var(--green)'       },
    { key: 'lower',       label: 'Lower Deck',    value: lower,       cls: 'lower',       color: 'var(--blue)'        },
    { key: 'noguarantee', label: 'No Guarantee',  value: noGuarantee, cls: 'noguarantee', color: 'var(--text-muted)'  },
  ];

  const has2026Warning = lower === 0 && upper === 0;

  return (
    <div className="bus-seat-map">
      <div className="bus-seat-title">Bus Deck Distribution</div>
      <div className="bus-seat-sub">PAX by deck assignment</div>

      {has2026Warning && (
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'8px 12px', borderRadius:'var(--radius)',
          background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)',
          color:'var(--amber)', fontSize:12, marginBottom:14,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Lower/Upper deck assignment not yet available for 2026 — data pending from pipeline
        </div>
      )}

      {/* Bus body visual */}
      <div style={{
        background:'var(--surface-2)', border:'2px solid var(--border)',
        borderRadius:14, padding:'16px 20px', maxWidth:540,
      }}>
        {/* Bus roof */}
        <div style={{
          height:10, background:'var(--surface-3)',
          borderRadius:'8px 8px 0 0', marginBottom:4,
          borderBottom:'1px solid var(--border)',
        }} />

        {decks.map((d, i) => (
          <div key={d.key} style={{ marginBottom: i < decks.length-1 ? 10 : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--text-dim)', width:100, flexShrink:0 }}>
                {d.label}
              </span>
              <span style={{ fontSize:12, fontFamily:'var(--mono)', color:d.color, fontWeight:600 }}>
                {fmtNum(d.value)} PAX
              </span>
            </div>
            <div style={{
              height:34, background:'var(--bg)',
              borderRadius:6, overflow:'hidden',
              border:'1px solid var(--border)',
              position:'relative',
            }}>
              <div
                className={`deck-fill-bar ${d.cls}`}
                style={{ width: `${pct(d.value)}%`, height:'100%', borderRadius:0, border:'none' }}
              >
                {d.value > 0 && (
                  <span style={{ paddingLeft:10, fontSize:11, fontWeight:600 }}>
                    {total > 0 ? `${Math.round((d.value/total)*100)}%` : '–'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Seat rows visual */}
        <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:4 }}>
          {Array.from({ length: Math.min(Math.ceil((total || 50) / 4), 12) }).map((_, i) => (
            <div key={i} style={{ display:'flex', gap:3 }}>
              {[0,1,2,3].map(s => (
                <div key={s} style={{
                  width:14, height:14, borderRadius:3,
                  background: i*4+s < lower ? 'rgba(77,158,255,.35)'
                    : i*4+s < lower+upper ? 'rgba(34,211,165,.3)'
                    : 'var(--surface-3)',
                  border:'1px solid var(--border)',
                  transition:'background .3s',
                }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, display:'flex', gap:16 }}>
          {[
            { color:'rgba(77,158,255,.35)', label:'Lower deck' },
            { color:'rgba(34,211,165,.3)',  label:'Upper deck' },
            { color:'var(--surface-3)',     label:'No guarantee' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:l.color, border:'1px solid var(--border)' }} />
              <span style={{ fontSize:11, color:'var(--text-dim)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bar charts for PAX & Bookings by bus type ──────────────────────────────
function BusBarCharts({ summary }) {
  const data = useMemo(() => {
    if (!summary?.length) return [];
    return summary
      .map(r => ({
        name: busLabel(r.bus_type),
        PAX: Number(r.pax) || 0,
        Bookings: Number(r.bookings) || 0,
        busType: r.bus_type ?? '',
      }))
      .sort((a, b) => b.PAX - a.PAX);
  }, [summary]);

  if (!data.length) return (
    <div className="empty-state"><span>No bus occupancy data — apply filters or check connection.</span></div>
  );

  return (
    <div className="occ-charts">
      <div className="occ-chart-wrap">
        <div className="occ-chart-title">Total PAX by Bus Type</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} width={44} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="PAX" radius={[6,6,0,0]} maxBarSize={64}>
              {data.map((d, i) => <Cell key={i} fill={busColor(d.busType)} />)}
              <LabelList dataKey="PAX" position="top"
                formatter={v => fmtNum(v)}
                style={{ fontSize:11, fill:'var(--text-muted)', fontFamily:'var(--mono)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="occ-chart-wrap">
        <div className="occ-chart-title">Bookings by Bus Type</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Bookings" radius={[6,6,0,0]} maxBarSize={64}>
              {data.map((d, i) => <Cell key={i} fill={busColor(d.busType)} opacity={0.75} />)}
              <LabelList dataKey="Bookings" position="top"
                formatter={v => fmtNum(v)}
                style={{ fontSize:11, fill:'var(--text-muted)', fontFamily:'var(--mono)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      <div className="occ-summary">
        {data.map(row => {
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
                <span>avg {avg} PAX</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail table ───────────────────────────────────────────────────────────
function BusDetailTable({ detail }) {
  const rows = useMemo(() => {
    if (!detail?.length) return [];
    const map = {};
    detail.forEach(r => {
      const dep = r.departure_date ? String(r.departure_date).slice(0,10) : '–';
      const ret = r.return_date    ? String(r.return_date).slice(0,10)    : '–';
      const key = `${dep}__${ret}__${r.bus_type}`;
      if (!map[key]) map[key] = {
        departure_date: dep, return_date: ret,
        outbound_bus: r.bus_type ?? '',
        pax: 0, bookings: 0, revenue: 0,
      };
      map[key].pax      += Number(r.pax)      || 0;
      map[key].bookings += Number(r.bookings)  || 0;
      map[key].revenue  += Number(r.revenue)   || 0;
    });
    return Object.values(map)
      .sort((a, b) => a.departure_date.localeCompare(b.departure_date))
      .map((row, i, arr) => ({
        ...row,
        pax_diff: i > 0 ? row.pax - arr[i-1].pax : null,
      }));
  }, [detail]);

  if (!rows.length) return (
    <div className="empty-state"><span>No bus detail data.</span></div>
  );

  const totals = rows.reduce((a, r) => ({
    pax: a.pax + r.pax, bookings: a.bookings + r.bookings,
  }), { pax: 0, bookings: 0 });

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Departure Date</th>
            <th>Bus Type</th>
            <th>Return Date</th>
            <th>Bookings</th>
            <th>PAX</th>
            <th>PAX Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const diffCls = row.pax_diff === null ? 'neu' : row.pax_diff > 0 ? 'pos' : row.pax_diff < 0 ? 'neg' : 'neu';
            return (
              <tr key={i}>
                <td className="td-month">{row.departure_date}</td>
                <td>
                  <span className="bus-badge" style={{
                    background: busColor(row.outbound_bus) + '22',
                    color: busColor(row.outbound_bus),
                  }}>
                    {busLabel(row.outbound_bus)}
                  </span>
                </td>
                <td className="td-month">{row.return_date}</td>
                <td>{fmtNum(row.bookings)}</td>
                <td style={{ fontWeight:600, color:'var(--text)' }}>{fmtNum(row.pax)}</td>
                <td className={`td-diff ${diffCls}`}>
                  {row.pax_diff === null ? '–' : (row.pax_diff >= 0 ? '+' : '') + fmtNum(row.pax_diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td className="td-month" colSpan={3}>TOTAL</td>
            <td>{fmtNum(totals.bookings)}</td>
            <td style={{ fontWeight:700, color:'var(--text)' }}>{fmtNum(totals.pax)}</td>
            <td>–</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export function BusOccupancyView({ data }) {
  const kpiData = data?.kpis || null;

  return (
    <div className="view-content">

      {/* KPI Strip */}
      <BusKpiStrip data={kpiData} />

      {/* Deck visual + bar charts side by side */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:'0 0 auto', minWidth:320 }}>
          <BusSeatMap data={kpiData} />
        </div>
        <div style={{ flex:1, minWidth:300 }}>
          <div style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)', padding:20, height:'100%',
          }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:16 }}>
              PAX & Bookings by Bus Type
            </div>
            <BusBarCharts summary={data?.summary} />
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="section-card">
        <div className="card-header">
          <span className="card-title">Bus Occupancy Detail</span>
          <span className="card-badge">Outbound & Inbound by Date</span>
        </div>
        <BusDetailTable detail={data?.detail} />
      </div>

    </div>
  );
}
