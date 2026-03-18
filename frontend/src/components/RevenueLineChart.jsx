import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_COLORS = {
  2023: '#3b82f6',
  2024: '#10b981',
  2025: '#f59e0b',
  2026: '#8b5cf6',
};

function fmtEuro(v) {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${v}`;
}

export function RevenueLineChart({ data }) {
  const { chartData, years } = useMemo(() => {
    if (!data?.length) return { chartData: [], years: [] };
    const yearSet = new Set();
    const byKey = {};
    data.forEach((d) => {
      const y = Number(d.year);
      const m = Number(d.month);
      if (!y || !m) return;
      yearSet.add(y);
      const key = `${m}`;
      if (!byKey[key]) byKey[key] = { month: MONTHS[m - 1], monthNum: m };
      byKey[key][`y${y}`] = Number(d.revenue) || 0;
    });
    const chartData = Object.values(byKey).sort((a, b) => a.monthNum - b.monthNum);
    const years = Array.from(yearSet).sort();
    return { chartData, years };
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="empty-state">
        <span>No revenue data — apply filters.</span>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 10, right: 24, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `€${(v / 1e3).toFixed(0)}K` : v)}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
            formatter={(value) => [fmtEuro(value), '']}
            labelStyle={{ color: 'var(--text)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {years.map((yr) => (
            <Line
              key={yr}
              type="monotone"
              dataKey={`y${yr}`}
              name={String(yr)}
              stroke={YEAR_COLORS[yr] || '#6b7280'}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
