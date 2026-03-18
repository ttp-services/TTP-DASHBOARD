import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

function fmtVal(v, metric) {
  if (metric === 'turnover') {
    if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
    return `€${v}`;
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v;
}

function getField(d, metric) {
  if (metric === 'turnover') return Number(d.revenue) || 0;
  if (metric === 'pax') return Number(d.pax) || 0;
  return Number(d.bookings) || 0;
}

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="ct-row">
          <span className="ct-dot" style={{ background: p.color }} />
          <span className="ct-key">{p.dataKey}</span>
          <span className="ct-val">
            {metric === 'turnover' ? '€' : ''}{new Intl.NumberFormat('en-US').format(Math.round(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
};

export function TrendChart({ data, metric }) {
  const { chartData, years } = useMemo(() => {
    if (!data?.length) return { chartData: [], years: [] };
    const yearSet = new Set();
    const byMonth = {};
    data.forEach((d) => {
      yearSet.add(d.year);
      const key = String(d.month).padStart(2, '0');
      if (!byMonth[key]) byMonth[key] = { month: MONTHS[d.month - 1] ?? d.month };
      byMonth[key][String(d.year)] = getField(d, metric);
    });
    return {
      chartData: Object.values(byMonth).sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)),
      years: Array.from(yearSet).sort(),
    };
  }, [data, metric]);

  if (!chartData.length) return (
    <div className="empty-state">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="20" width="6" height="8" rx="1" fill="var(--text-muted)" opacity=".3"/><rect x="13" y="12" width="6" height="16" rx="1" fill="var(--text-muted)" opacity=".3"/><rect x="22" y="6" width="6" height="22" rx="1" fill="var(--text-muted)" opacity=".3"/></svg>
      <span>No data — connect Azure SQL.</span>
    </div>
  );

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false}
            tickFormatter={(v) => fmtVal(v, metric)} width={60} />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          {years.map((yr, i) => (
            <Line key={yr} type="monotone" dataKey={String(yr)}
              stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
