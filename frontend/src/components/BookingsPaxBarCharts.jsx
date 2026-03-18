import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtNum(n) {
  if (!Number.isFinite(Number(n))) return '–';
  return new Intl.NumberFormat('en-US').format(Math.round(Number(n)));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="ct-row">
          <span className="ct-dot" style={{ background: p.color }} />
          <span className="ct-key">{p.name}</span>
          <span className="ct-val">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function BookingsBarChart({ data }) {
  const chartData = useMemo(() => {
    if (!data?.length) return [];
    const curYear = new Date().getFullYear();
    return data
      .filter((r) => Number(r.year) === curYear)
      .map((r) => ({
        month: MONTHS[(Number(r.month) || 1) - 1],
        'Current year': Number(r.currentBookings) || 0,
        'Previous year': Number(r.previousBookings) || 0,
      }))
      .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="empty-state">
        <span>No bookings data — apply filters.</span>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 24, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Current year" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Current year" />
          <Bar dataKey="Previous year" fill="#6b7280" radius={[4, 4, 0, 0]} name="Previous year" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaxBarChart({ data }) {
  const chartData = useMemo(() => {
    if (!data?.length) return [];
    const curYear = new Date().getFullYear();
    return data
      .filter((r) => Number(r.year) === curYear)
      .map((r) => ({
        month: MONTHS[(Number(r.month) || 1) - 1],
        'Current year': Number(r.currentPax) || 0,
        'Previous year': Number(r.previousPax) || 0,
      }))
      .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="empty-state">
        <span>No PAX data — apply filters.</span>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 24, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Current year" fill="#10b981" radius={[4, 4, 0, 0]} name="Current year" />
          <Bar dataKey="Previous year" fill="#6b7280" radius={[4, 4, 0, 0]} name="Previous year" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
