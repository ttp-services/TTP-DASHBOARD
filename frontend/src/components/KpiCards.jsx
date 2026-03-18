import React from 'react';

function toNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtNum(n) {
  const v = toNum(n);
  if (v === null) return '–';
  return new Intl.NumberFormat('en-US').format(Math.round(v));
}

function fmtEuro(n) {
  const v = toNum(n);
  if (v === null) return '–';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(1)}K`;
  return `€${new Intl.NumberFormat('en-US').format(Math.round(v))}`;
}

function fmtPct(n) {
  const v = toNum(n);
  if (v === null) return '–';
  const num = Number(v);
  return Number.isFinite(num) ? (num >= 0 ? `+${num.toFixed(1)}%` : `${num.toFixed(1)}%`) : '–';
}

function Arrow({ positive }) {
  if (positive === null) return null;
  return positive ? (
    <svg className="arrow up" width="14" height="14" viewBox="0 0 12 12" fill="none">
      <path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className="arrow down" width="14" height="14" viewBox="0 0 12 12" fill="none">
      <path d="M6 2v8M2 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({ title, current, previous, difference, percent, isCurrency }) {
  const pct = toNum(percent);
  const positive = pct === null ? null : pct > 0;
  const cls = pct === null ? 'neu' : pct > 0 ? 'pos' : 'neg';
  const fmt = isCurrency ? fmtEuro : fmtNum;

  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{fmt(current)}</div>
      <div className="kpi-meta">
        <span className="kpi-prev">vs previous year {fmt(previous)}</span>
        <span className={`kpi-badge ${cls}`}>
          <Arrow positive={positive} />
          {fmtPct(percent)}
        </span>
      </div>
      <div className={`kpi-diff-line ${cls}`}>
        {toNum(difference) >= 0 ? '+' : ''}
        {fmt(difference)} difference
      </div>
      <div className="kpi-bar-track">
        <div className={`kpi-bar-fill ${cls}`} style={{ width: `${Math.min(Math.abs(pct ?? 0), 100)}%` }} />
      </div>
    </div>
  );
}

export function KpiCards({ data }) {
  if (!data) {
    return <div className="kpi-empty">No data — check connection and apply filters.</div>;
  }

  return (
    <section className="kpis">
      <KpiCard
        title="Current year bookings vs previous year"
        current={data.currentBookings}
        previous={data.previousBookings}
        difference={data.differenceBookings}
        percent={data.percentBookings}
        isCurrency={false}
      />
      <KpiCard
        title="Current year PAX vs previous year"
        current={data.currentPax}
        previous={data.previousPax}
        difference={data.differencePax}
        percent={data.percentPax}
        isCurrency={false}
      />
      <KpiCard
        title="Current year revenue vs previous year"
        current={data.currentRevenue}
        previous={data.previousRevenue}
        difference={data.differenceRevenue}
        percent={data.percentRevenue}
        isCurrency
      />
    </section>
  );
}
