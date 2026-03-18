import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];

function getVal(row, metric) {
  if (metric === 'turnover') return Number(row.revenue) || 0;
  if (metric === 'pax') return Number(row.pax) || 0;
  return Number(row.bookings) || 0;
}

function fmtVal(v, metric) {
  if (metric === 'turnover') {
    if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
    return `€${Math.round(v)}`;
  }
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return Math.round(v);
}

const BarTip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      <div className="ct-row">
        <span className="ct-dot" style={{ background: payload[0]?.fill }} />
        <span className="ct-val">{fmtVal(payload[0]?.value, metric)}</span>
      </div>
    </div>
  );
};

const PieTip = ({ active, payload, metric }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{p.name}</div>
      <div className="ct-row">
        <span className="ct-dot" style={{ background: p.payload.fill }} />
        <span className="ct-val">{fmtVal(p.value, metric)}</span>
        <span className="ct-key" style={{ marginLeft: 4 }}>({p.payload.percent?.toFixed(1)}%)</span>
      </div>
    </div>
  );
};

function BreakdownPanel({ title, rows, metric, colorOffset = 0 }) {
  const data = useMemo(() => {
    if (!rows?.length) return [];
    return rows
      .map((r) => ({ name: r.label, value: getVal(r, metric) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [rows, metric]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const pieData = data.map((d) => ({ ...d, percent: total ? (d.value / total) * 100 : 0 }));

  if (!data.length) return (
    <div className="breakdown-panel">
      <div className="breakdown-title">{title}</div>
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <span>No data</span>
      </div>
    </div>
  );

  return (
    <div className="breakdown-panel">
      <div className="breakdown-title">{title}</div>
      <div className="breakdown-charts">
        {/* Bar chart */}
        <div className="breakdown-bar">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false}
                axisLine={false} tickFormatter={(v) => fmtVal(v, metric)} />
              <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11}
                tickLine={false} axisLine={false} width={90} />
              <Tooltip content={<BarTip metric={metric} />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[(i + colorOffset) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="breakdown-pie">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[(i + colorOffset) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTip metric={metric} />} />
              <Legend
                formatter={(value) => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{value}</span>}
                iconSize={8}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function BreakdownCharts({ data, metric }) {
  if (!data) return null;

  return (
    <section className="section">
      <div className="section-header">
        <h2>Breakdown Analysis</h2>
        <span className="section-badge">{metric === 'turnover' ? 'Turnover €' : metric === 'pax' ? 'PAX' : 'Bookings'}</span>
      </div>
      <div className="breakdown-grid">
        <BreakdownPanel title="By Transport Type" rows={data?.byTransport} metric={metric} colorOffset={0} />
        <BreakdownPanel title="By Region" rows={data?.byRegion} metric={metric} colorOffset={2} />
        <BreakdownPanel title="By Destination" rows={data?.byDestination} metric={metric} colorOffset={4} />
      </div>
    </section>
  );
}
