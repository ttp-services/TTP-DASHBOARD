import { useState, useEffect, useCallback, useRef } from "react";
import Login from "./Login.jsx";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

// ─── API HELPERS ──────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("ttp_token") || sessionStorage.getItem("ttp_token") || "";
}
function apiHeaders() {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === "") return;
    if (Array.isArray(v)) v.forEach(x => sp.append(k, x));
    else sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}
async function apiFetch(path, params = {}) {
  const r = await fetch(`${BASE}${path}${qs(params)}`, { headers: apiHeaders() });
  if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
const fmtN = n => n == null ? "—" : Number(n).toLocaleString("nl-BE");
const fmtEur = n => {
  if (n == null) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return `€${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `€${(v / 1e3).toFixed(0)}K`;
  return `€${v.toLocaleString("nl-BE")}`;
};
const fmtPct = n => n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#f59e0b","#22c55e","#8b5cf6","#3b82f6","#ef4444","#06b6d4","#f97316"];

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Icons = {
  overview: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  bus:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>,
  hotel:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v15M2 22h20M15 22v-4a3 3 0 0 0-6 0v4"/><rect x="9" y="7" width="2" height="3"/><rect x="13" y="7" width="2" height="3"/></svg>,
  table:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>,
  ai:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.04-5.44"/></svg>,
  filter:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  close:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  arrowUp:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  arrowDn:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  send:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  eye:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  search:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  user:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  plus:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  edit:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
};

// ─── LINE CHART (canvas) ──────────────────────────────────────────────────────
function LineChart({ data }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const ptsRef = useRef([]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height, pad = { top: 24, right: 16, bottom: 36, left: 54 };
    ctx.clearRect(0, 0, W, H);
    if (!data?.length) return;
    const years = [...new Set(data.map(d => d.year))].sort();
    const allMonths = MONTHS.map((_, i) => i + 1);
    const byY = {};
    data.forEach(d => { if (!byY[d.year]) byY[d.year] = {}; byY[d.year][d.month] = d.revenue || 0; });
    const allVals = data.map(d => d.revenue || 0);
    const maxV = Math.max(...allVals, 1);
    const sx = i => pad.left + (i / (allMonths.length - 1)) * (W - pad.left - pad.right);
    const sy = v => pad.top + (1 - v / maxV) * (H - pad.top - pad.bottom);
    // Grid
    ctx.strokeStyle = "rgba(30,58,95,0.5)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * (H - pad.top - pad.bottom);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const v = maxV * (1 - i / 4);
      ctx.fillStyle = "#3d5a80"; ctx.font = "10px Geist, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(fmtEur(v), pad.left - 6, y + 4);
    }
    MONTHS.forEach((m, i) => {
      ctx.fillStyle = "#3d5a80"; ctx.font = "10px Geist, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(m, sx(i), H - pad.bottom + 16);
    });
    ptsRef.current = [];
    years.forEach((yr, yi) => {
      const color = YEAR_COLORS[yi % YEAR_COLORS.length];
      const pts = allMonths.map(m => ({ x: sx(m - 1), y: sy(byY[yr]?.[m] || 0), val: byY[yr]?.[m] || 0 }));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      pts.forEach(p => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        ptsRef.current.push({ ...p, year: yr, month: MONTHS[allMonths.indexOf(pts.indexOf(p)) % 12], color });
      });
      // Legend
      const lx = pad.left + yi * 70;
      ctx.fillStyle = color; ctx.fillRect(lx, 6, 14, 3);
      ctx.fillStyle = "#7a9cc8"; ctx.font = "10px Geist, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(String(yr), lx + 18, 12);
    });
  }, [data]);

  const onMove = e => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = ptsRef.current.find(p => Math.hypot(p.x - mx, p.y - my) < 12);
    setTip(hit ? { ...hit, cx: mx, cy: my } : null);
  };

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={ref} style={{ width: "100%", height: 220, display: "block" }} onMouseMove={onMove} onMouseLeave={() => setTip(null)} />
      {tip && (
        <div style={{ position: "absolute", left: tip.cx + 10, top: tip.cy - 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, pointerEvents: "none", zIndex: 10 }}>
          <b style={{ color: tip.color }}>{tip.year}</b> · {tip.month}<br />
          <span style={{ color: "var(--text)" }}>{fmtEur(tip.val)}</span>
        </div>
      )}
    </div>
  );
}

// ─── BAR CHART (canvas) ───────────────────────────────────────────────────────
function BarChart({ data, metric = "bookings" }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const barsRef = useRef([]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height, pad = { top: 24, right: 16, bottom: 36, left: 54 };
    ctx.clearRect(0, 0, W, H);
    if (!data?.length) return;
    const years = [...new Set(data.map(d => d.year))].sort();
    const byY = {};
    data.forEach(d => {
      if (!byY[d.year]) byY[d.year] = {};
      const key = d.month;
      const v = metric === "bookings" ? d.bookings : metric === "pax" ? d.pax : d.revenue;
      if (!byY[d.year][key]) byY[d.year][key] = 0;
      byY[d.year][key] += v || 0;
    });
    const allMonths = MONTHS.map((_, i) => i + 1);
    const allVals = Object.values(byY).flatMap(m => Object.values(m));
    const maxV = Math.max(...allVals, 1);
    const slotW = (W - pad.left - pad.right) / allMonths.length;
    const bW = Math.max(2, (slotW / years.length) - 2);
    const sy = v => pad.top + (1 - v / maxV) * (H - pad.top - pad.bottom);
    // Grid
    ctx.strokeStyle = "rgba(30,58,95,0.5)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * (H - pad.top - pad.bottom);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }
    MONTHS.forEach((m, i) => {
      ctx.fillStyle = "#3d5a80"; ctx.font = "10px Geist, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(m, pad.left + (i + 0.5) * slotW, H - pad.bottom + 16);
    });
    barsRef.current = [];
    allMonths.forEach((mo, mi) => {
      years.forEach((yr, yi) => {
        const v = byY[yr]?.[mo] || 0;
        const color = YEAR_COLORS[yi % YEAR_COLORS.length];
        const x = pad.left + mi * slotW + yi * (bW + 1);
        const barH = Math.max(1, (H - pad.top - pad.bottom) * v / maxV);
        const yy = sy(v);
        ctx.fillStyle = color + "cc";
        ctx.fillRect(x, yy, bW, barH);
        barsRef.current.push({ x, y: yy, w: bW, h: barH, year: yr, month: MONTHS[mi], value: v, color });
      });
    });
    // Legend
    years.forEach((yr, yi) => {
      const color = YEAR_COLORS[yi % YEAR_COLORS.length];
      const lx = pad.left + yi * 70;
      ctx.fillStyle = color; ctx.fillRect(lx, 6, 14, 3);
      ctx.fillStyle = "#7a9cc8"; ctx.font = "10px Geist, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(String(yr), lx + 18, 12);
    });
  }, [data, metric]);

  const onMove = e => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = barsRef.current.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
    setTip(hit ? { ...hit, cx: mx, cy: my } : null);
  };

  const fmt = v => metric === "revenue" ? fmtEur(v) : fmtN(v) + (metric === "pax" ? " PAX" : " bookings");

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={ref} style={{ width: "100%", height: 220, display: "block" }} onMouseMove={onMove} onMouseLeave={() => setTip(null)} />
      {tip && (
        <div style={{ position: "absolute", left: tip.cx + 10, top: tip.cy - 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, pointerEvents: "none", zIndex: 10 }}>
          <b style={{ color: tip.color }}>{tip.year}</b> · {tip.month}<br />
          <span style={{ color: "var(--text)" }}>{fmt(tip.value)}</span>
        </div>
      )}
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, curr, prev, diff, pct, fmt, color, prevLabel }) {
  const up = diff > 0, down = diff < 0;
  return (
    <div style={{ flex: 1, minWidth: 200, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", lineHeight: 1, marginBottom: 6 }}>{curr != null ? fmt(curr) : "—"}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        {prev != null && prev > 0 ? <>{prevLabel || "prev"}: <span style={{ fontWeight: 600 }}>{fmt(prev)}</span></> : <span style={{ color: "var(--text-dim)" }}>no previous data</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {diff != null && diff !== 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, color: up ? "var(--green)" : "var(--red)", fontSize: 12, fontWeight: 700 }}>
            {up ? Icons.arrowUp : Icons.arrowDn}{fmt(Math.abs(diff))}
          </span>
        )}
        {pct != null && (
          <span style={{ background: up ? "var(--green-dim)" : down ? "var(--red-dim)" : "var(--surface-2)", color: up ? "var(--green)" : down ? "var(--red)" : "var(--text-muted)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>
            {fmtPct(pct)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── YEAR-MONTH TABLE ─────────────────────────────────────────────────────────
function YearMonthTable({ data, metric }) {
  const rows = [...(data || [])].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  const getCurr = r => metric === "pax" ? r.currentPax : metric === "revenue" ? r.currentRevenue : r.currentBookings;
  const getPrev = r => metric === "pax" ? r.previousPax : metric === "revenue" ? r.previousRevenue : r.previousBookings;
  const getDiff = r => metric === "pax" ? r.diffPax : metric === "revenue" ? r.diffRevenue : r.diffBookings;
  const getPct  = r => metric === "pax" ? r.diffPctPax : metric === "revenue" ? r.diffPctRevenue : r.diffPctBookings;
  const fmt = v => v == null ? "—" : metric === "revenue" ? fmtEur(v) : fmtN(v);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
        <thead>
          <tr style={{ background: "var(--bg-2)" }}>
            {["Period","Last Year","Current","Previous","Difference","Diff %"].map(h => (
              <th key={h} style={{ padding: "9px 14px", textAlign: h === "Period" ? "left" : "right", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows.length && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No data</td></tr>}
          {rows.map((r, i) => {
            const diff = getDiff(r); const pct = getPct(r);
            const up = diff > 0, down = diff < 0;
            return (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-2)" }}>
                <td style={{ padding: "9px 14px", color: "var(--blue)", fontWeight: 600, whiteSpace: "nowrap" }}>{`${MONTHS[(r.month||1)-1]}-${r.year}`}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: "var(--text-muted)" }}>{`${MONTHS[(r.month||1)-1]}-${(r.year||0)-1}`}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600, color: "var(--text)" }}>{fmt(getCurr(r))}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: "var(--text-muted)" }}>{fmt(getPrev(r))}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: up ? "var(--green)" : down ? "var(--red)" : "var(--text-muted)", fontWeight: 600 }}>{diff != null ? (up ? "+" : "") + fmt(diff) : "—"}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: up ? "var(--green)" : down ? "var(--red)" : "var(--text-muted)" }}>{pct != null ? fmtPct(pct) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── BUS PENDEL TABLE ─────────────────────────────────────────────────────────
function PendelTable({ data }) {
  if (!data?.length) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No pendel data</div>;
  const cols = [
    { label: "Start Date", key: "StartDate", sticky: true },
    { label: "End Date", key: "EndDate" },
    { label: "Pendel", key: "NormalizedPendel" },
    { label: "Out RC", key: "ORC", right: true },
    { label: "Out FC", key: "OFC", right: true },
    { label: "Out PRE", key: "OPRE", right: true },
    { label: "Out Total", key: "Outbound_Total", right: true, bold: true, color: "var(--blue)" },
    { label: "In RC", key: "RRC", right: true },
    { label: "In FC", key: "RFC", right: true },
    { label: "In PRE", key: "RPRE", right: true },
    { label: "In Total", key: "Inbound_Total", right: true, bold: true, color: "var(--green)" },
    { label: "Diff RC", key: "Diff_Royal", right: true },
    { label: "Diff FC", key: "Diff_First", right: true },
    { label: "Diff PRE", key: "Diff_Premium", right: true },
    { label: "Diff Total", key: "Diff_Total", right: true, bold: true },
  ];
  return (
    <div style={{ overflowX: "auto", maxHeight: 520 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 1100 }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr style={{ background: "var(--bg-2)" }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: "9px 12px", textAlign: c.right ? "right" : "left", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", ...(c.sticky ? { position: "sticky", left: 0, background: "var(--bg-2)", zIndex: 3 } : {}) }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-2)" }}>
              {cols.map(c => {
                const v = row[c.key];
                const isNum = typeof v === "number";
                const color = c.color || (isNum && v < 0 ? "var(--red)" : isNum && v > 0 ? "var(--text)" : "var(--text)");
                return (
                  <td key={c.key} style={{ padding: "8px 12px", textAlign: c.right ? "right" : "left", color: c.key === "StartDate" || c.key === "EndDate" ? "var(--blue)" : color, fontWeight: c.bold ? 700 : 400, whiteSpace: "nowrap", ...(c.sticky ? { position: "sticky", left: 0, background: i % 2 === 0 ? "var(--surface)" : "var(--bg-2)", zIndex: 1 } : {}) }}>
                    {v != null ? (isNum ? (v > 0 && c.key.startsWith("Diff") ? `+${fmtN(v)}` : fmtN(v)) : v) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── BUS FEEDER TABLE ─────────────────────────────────────────────────────────
function FeederTable({ data }) {
  if (!data?.length) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No feeder data</div>;
  return (
    <div style={{ overflowX: "auto", maxHeight: 520 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr style={{ background: "var(--bg-2)" }}>
            {["Departure Date","Label","Feeder Line","Route","Stop","Stop Type","Total PAX","Bookings"].map(h => (
              <th key={h} style={{ padding: "9px 12px", textAlign: h === "Total PAX" || h === "Bookings" ? "right" : "left", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-2)" }}>
              <td style={{ padding: "8px 12px", color: "var(--blue)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.DepartureDate}</td>
              <td style={{ padding: "8px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{r.LabelName}</td>
              <td style={{ padding: "8px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.FeederLine}</td>
              <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.RouteNo} {r.RouteLabel}</td>
              <td style={{ padding: "8px 12px", color: "var(--text)", fontWeight: 500 }}>{r.StopName}</td>
              <td style={{ padding: "8px 12px", color: "var(--text-dim)" }}>{r.StopType}</td>
              <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--green)", fontWeight: 700 }}>{fmtN(r.TotalPax)}</td>
              <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>{fmtN(r.BookingCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── BUS DECK TABLE ───────────────────────────────────────────────────────────
function DeckTable({ data }) {
  if (!data?.length) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No deck data</div>;
  const allZero = data.every(r => !r.Outbound_Deck || r.Outbound_Deck.includes("Geen"));
  return (
    <div>
      {allZero && (
        <div style={{ padding: "8px 16px", background: "var(--amber-dim)", borderBottom: "1px solid rgba(245,158,11,0.3)", fontSize: 11, color: "var(--amber)", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Lower / Upper deck assignment not yet available for 2026 — data pending from pipeline
        </div>
      )}
      <div style={{ overflowX: "auto", maxHeight: 520 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr style={{ background: "var(--bg-2)" }}>
              {["Departure Date","Class","Deck","Status","Region","Label","PAX","Bookings"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: h === "PAX" || h === "Bookings" ? "right" : "left", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const statusColor = r.Status === "DEF" ? "var(--green)" : r.Status === "TIJD" ? "var(--amber)" : r.Status === "VERV" ? "var(--red)" : "var(--text-muted)";
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-2)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--blue)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.dateDeparture}</td>
                  <td style={{ padding: "8px 12px", color: "var(--purple)", fontWeight: 500 }}>{r.Outbound_Class}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 11 }}>{r.Outbound_Deck || "—"}</td>
                  <td style={{ padding: "8px 12px" }}><span style={{ background: `${statusColor}22`, color: statusColor, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{r.Status}</span></td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.Region || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.Label || "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--green)", fontWeight: 700 }}>{fmtN(r.PAX)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>{fmtN(r.Bookings)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── HOTEL TAB ────────────────────────────────────────────────────────────────
function HotelTab({ token }) {
  const [ratings, setRatings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [selHotel, setSelHotel] = useState(null);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BASE}/api/dashboard/hotel-stats`, { headers: h }).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/api/dashboard/hotel-ratings`, { headers: h }).then(r => r.json()).catch(() => []),
    ]).then(([s, r]) => {
      setStats(s); setRatings(Array.isArray(r) ? r : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const loadReviews = code => {
    setSelHotel(code);
    fetch(`${BASE}/api/dashboard/hotel-reviews?code=${code}&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setReviews(d.rows || [])).catch(() => {});
  };

  const filtered = ratings.filter(r => (r.accommodation_name || "").toLowerCase().includes(search.toLowerCase()));
  const scoreColor = v => v >= 80 ? "var(--green)" : v >= 60 ? "var(--amber)" : "var(--red)";

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading hotel data…</div>;

  return (
    <div className="tab-content">
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Hotels", value: fmtN(stats?.total_hotels) },
          { label: "Reviews", value: fmtN(stats?.total_reviews) },
          { label: "Avg Score", value: stats?.avg_rating ? `${Math.round(stats.avg_rating)}/100` : "—" },
          { label: "High Rated (≥80)", value: fmtN(stats?.high_rated) },
          { label: "Latest Review", value: stats?.latest_review ? stats.latest_review.split("T")[0] : "—" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-dim)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{s.value || "—"}</div>
          </div>
        ))}
      </div>

      {/* Ratings table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Hotel Ratings — {filtered.length} properties</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>{Icons.search}</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hotel…"
              style={{ padding: "6px 12px 6px 30px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 12, outline: "none", width: 200 }} />
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 400 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: "var(--bg-2)" }}>
                {["Hotel","Code","Overall","Location","Hygiene","Service","Reviews","Action"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((r, i) => (
                <tr key={r.accommodation_code} style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "var(--bg-2)" : "transparent" }}>
                  <td style={{ padding: "8px 12px", color: "var(--text)", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.accommodation_name || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 11 }}>{r.accommodation_code}</td>
                  <td style={{ padding: "8px 12px", color: scoreColor(r.avg_overall), fontWeight: 700, fontFamily: "var(--mono)" }}>{r.avg_overall || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.avg_location || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.avg_cleanliness || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.avg_service || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{fmtN(r.total_reviews)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <button onClick={() => loadReviews(r.accommodation_code)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--blue)", fontSize: 11, cursor: "pointer" }}>Reviews</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reviews panel */}
      {selHotel && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Reviews — {selHotel}</span>
            <button onClick={() => setSelHotel(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>{Icons.close}</button>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
            {reviews.map((r, i) => (
              <div key={i} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(r.overall_rating), fontFamily: "var(--mono)" }}>{r.overall_rating || "—"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{r.review_title || "—"}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-dim)" }}>{r.review_date?.split("T")[0]}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 6 }}>{r.review_text || "No text provided"}</p>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{r.reviewer_name} · {r.reviewer_country} · {r.travel_type}</div>
              </div>
            ))}
            {!reviews.length && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>No reviews available</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DATA TABLE TAB ───────────────────────────────────────────────────────────
function DataTableTab({ token, applied }) {
  const [rows, setRows]   = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: 50, ...applied };
      const d = await apiFetch("/api/dashboard/bookings-table", params);
      setRows(d.rows || []); setTotal(d.total || 0); setPage(pg);
    } catch {} finally { setLoading(false); }
  }, [applied]);

  useEffect(() => { load(1); }, [load]);

  const filtered = rows.filter(r =>
    !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  const exportCSV = () => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${r[k] ?? ""}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `ttp-bookings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="tab-content">
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flex: 1 }}>Bookings — {fmtN(total)} records</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>{Icons.search}</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ padding: "6px 12px 6px 28px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 12, outline: "none", width: 180 }} />
          </div>
          <button onClick={() => load(page)} style={{ padding: "6px 12px", borderRadius: "var(--radius)", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Refresh</button>
          <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--radius)", background: "var(--blue-dim)", border: "1px solid rgba(77,158,255,0.3)", color: "var(--blue)", fontSize: 12, cursor: "pointer" }}>
            {Icons.download} Export CSV
          </button>
        </div>
        {loading && <div style={{ height: 3, background: "linear-gradient(90deg, var(--blue), var(--green))", animation: "pulse 1s ease infinite" }} />}
        <div style={{ overflowX: "auto", maxHeight: 520 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: "var(--bg-2)" }}>
                {["Booking ID","Dataset","Status","Label","Departure","PAX","Revenue"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: h === "PAX" || h === "Revenue" ? "right" : "left", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!filtered.length && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No data</td></tr>}
              {filtered.map((r, i) => {
                const isConf = r.Status === "DEF" || r.Status === "ok";
                const statusColor = isConf ? "var(--green)" : "var(--red)";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "var(--bg-2)" : "transparent" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 11 }}>{r.BookingID}</td>
                    <td style={{ padding: "8px 12px", color: "var(--blue)", fontWeight: 500 }}>{r.Dataset}</td>
                    <td style={{ padding: "8px 12px" }}><span style={{ background: `${statusColor}22`, color: statusColor, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{r.Status}</span></td>
                    <td style={{ padding: "8px 12px", color: "var(--text)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.Label}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{r.DepartureDate}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text)", fontFamily: "var(--mono)" }}>{fmtN(r.PAX)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--amber)", fontFamily: "var(--mono)", fontWeight: 600 }}>{fmtEur(r.Revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <span>Page {page} · Showing {rows.length} of {fmtN(total)}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {page > 1 && <button onClick={() => load(page - 1)} style={{ padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Prev</button>}
            {rows.length === 50 && <button onClick={() => load(page + 1)} style={{ padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Next</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI TAB ───────────────────────────────────────────────────────────────────
function AiTab({ user, kpiData }) {
  const [msgs, setMsgs]       = useState([{ role: "assistant", content: "Hi! I'm TTP AI — your analytics assistant.\n\nI have direct access to the live Azure SQL database. Ask me anything about bookings, revenue, PAX, or trends.\n\nFor best results, be specific: mention the dataset (Solmar/Snowtravel/etc.), the period, and what metric you need.", ts: new Date() }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const endRef                = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs(prev => [...prev, { role: "user", content: msg, ts: new Date() }]);
    setLoading(true);
    try {
      const token = getToken();
      const history = msgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: msg, history }),
      });
      const d = await r.json();
      setMsgs(prev => [...prev, { role: "assistant", content: d.reply || "No response.", source: d.source, ts: new Date() }]);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Connection error. Please try again.", isError: true, ts: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const fmt = d => `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  const SUGGESTED = ["Total bookings 2026 vs 2025?","Revenue by dataset all time","Cancellation rate this year","Compare Solmar vs Snowtravel 2026","Which month had most PAX in 2025?","Average revenue per booking?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 104px)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
      {/* Context bar */}
      {kpiData && (
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "10px 20px", background: "var(--bg-2)", borderBottom: "1px solid var(--border)", overflowX: "auto", flexShrink: 0 }}>
          {[["Live DB","● Connected","var(--green)"],["2026 Bookings",fmtN(kpiData.currentBookings),null],["2026 Revenue",fmtEur(kpiData.currentRevenue),null],["2026 PAX",fmtN(kpiData.currentPax),null]].map(([l,v,c]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{l}</span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--mono)", color: c || "var(--text)" }}>{v}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>AI will ask for clarification if unsure</span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0, background: m.role === "assistant" ? "var(--blue-dim)" : "var(--surface-3)", color: m.role === "assistant" ? "var(--blue)" : "var(--text-muted)", border: m.role === "assistant" ? "1px solid rgba(77,158,255,0.25)" : "none" }}>
              {m.role === "assistant" ? "✦" : (user?.name || "U")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, maxWidth: 680, alignItems: m.role === "user" ? "flex-end" : "flex-start", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{m.role === "assistant" ? "TTP AI" : user?.name || "You"}</span>
                {m.source && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: m.source === "openai" ? "var(--green-dim)" : "var(--amber-dim)", color: m.source === "openai" ? "var(--green)" : "var(--amber)" }}>{m.source === "openai" ? "GPT-4o" : "fallback"}</span>}
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{fmt(m.ts)}</span>
              </div>
              <div style={{ background: m.role === "user" ? "var(--blue-dim)" : m.isError ? "var(--red-dim)" : "var(--surface-2)", border: `1px solid ${m.role === "user" ? "rgba(77,158,255,0.2)" : m.isError ? "rgba(248,113,113,0.2)" : "var(--border)"}`, borderRadius: "12px", borderTopLeftRadius: m.role === "assistant" ? 3 : 12, borderTopRightRadius: m.role === "user" ? 3 : 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                {m.content.split("\n").map((line, j) => <p key={j} style={{ marginBottom: 3 }}>{line || "\u00A0"}</p>)}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--blue-dim)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "12px", borderTopLeftRadius: 3, padding: "14px 16px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,200,400].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-dim)", animation: `typingDot 1.4s ease ${d}ms infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {msgs.length === 1 && (
        <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>Try asking:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTED.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{ padding: "6px 12px", borderRadius: 20, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-2)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about bookings, revenue, PAX, trends… (Enter to send)"
            rows={1} disabled={loading}
            style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: "none", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", color: "var(--text)", fontSize: 13, outline: "none", overflowY: "auto" }} />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--blue)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", opacity: loading || !input.trim() ? 0.45 : 1, cursor: loading || !input.trim() ? "not-allowed" : "pointer" }}>
            {Icons.send}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", marginTop: 7 }}>TTP AI queries live Azure SQL. Validate critical numbers in the dashboard before acting.</p>
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({ token, user }) {
  const [stTab, setStTab]         = useState("users");
  const [users, setUsers]         = useState([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [newUser, setNewUser]     = useState({ name: "", username: "", email: "", password: "", role: "viewer" });
  const [showPw, setShowPw]       = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (stTab !== "users") return;
    setUsersLoading(true);
    fetch(`${BASE}/api/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [stTab, token]);

  const addUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) return alert("Name, username and password required");
    try {
      const r = await fetch(`${BASE}/api/auth/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newUser) });
      const d = await r.json();
      if (r.ok) { setUsers(p => [...p, d]); setNewUser({ name: "", username: "", email: "", password: "", role: "viewer" }); setShowAdd(false); }
      else alert(d.error || "Failed");
    } catch { alert("Connection error"); }
  };

  const deleteUser = async id => {
    if (!confirm("Delete this user?")) return;
    await fetch(`${BASE}/api/auth/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setUsers(p => p.filter(u => u.id !== id));
  };

  const TABS = [["users","User Management"],["theme","Theme"],["api","API & Integrations"],["alerts","Email Alerts"],["ai_prompts","AI Prompts"]];
  const inputStyle = { width: "100%", padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", display: "block", marginBottom: 6 };

  return (
    <div className="tab-content">
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setStTab(k)} style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: `2px solid ${stTab === k ? "var(--blue)" : "transparent"}`, color: stTab === k ? "var(--blue)" : "var(--text-muted)", fontSize: 13, fontWeight: stTab === k ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {/* USER MANAGEMENT */}
          {stTab === "users" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>User Accounts ({users.length})</span>
                <button onClick={() => setShowAdd(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--radius)", background: "var(--blue)", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{Icons.plus} Add New User</button>
              </div>
              {usersLoading ? <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-2)" }}>
                      {["Name","Username","Email","Role","Actions"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "var(--bg-2)" : "transparent" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text)" }}>{u.name}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 12 }}>{u.username}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 12 }}>{u.email || "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: u.role === "admin" ? "var(--blue-dim)" : "var(--surface-2)", color: u.role === "admin" ? "var(--blue)" : "var(--text-muted)" }}>{u.role}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {u.id !== user?.id && (
                            <button onClick={() => deleteUser(u.id)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--red)", cursor: "pointer", padding: "4px 8px", fontSize: 11 }}>Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {showAdd && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAdd(false)}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 380, boxShadow: "var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>Add New User</div>
                    {[["Full Name","name","text"],["Username","username","text"],["Email","email","email"]].map(([l, k, t]) => (
                      <div key={k} style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>{l}</label>
                        <input type={t} value={newUser[k] || ""} onChange={e => setNewUser(u => ({ ...u, [k]: e.target.value }))} style={inputStyle} />
                      </div>
                    ))}
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Password</label>
                      <div style={{ position: "relative" }}>
                        <input type={showPw ? "text" : "password"} value={newUser.password || ""} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} style={{ ...inputStyle, paddingRight: 40 }} />
                        <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
                          {showPw ? Icons.eyeOff : Icons.eye}
                        </button>
                      </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={labelStyle}>Role</label>
                      <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))} style={inputStyle}>
                        <option value="viewer">Viewer — can view dashboards only</option>
                        <option value="admin">Admin — can access Settings</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addUser} style={{ flex: 1, padding: "10px", borderRadius: "var(--radius)", background: "var(--blue)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add User</button>
                      <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "10px", borderRadius: "var(--radius)", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* THEME */}
          {stTab === "theme" && (
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Theme settings are applied per session. Dark mode is the default.</div>
              <div style={{ display: "flex", gap: 12 }}>
                {["Dark","Light"].map(t => (
                  <div key={t} style={{ padding: "16px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", cursor: "pointer", opacity: t === "Dark" ? 1 : 0.5, background: "var(--surface-2)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{t} Mode</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t === "Dark" ? "Current default" : "Coming soon"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API & INTEGRATIONS */}
          {stTab === "api" && (
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Connected data sources and API integrations.</div>
              {[["Azure SQL","ttpserver.database.windows.net","Connected","var(--green)"],["TravelTrustIt API","9,020 reviews loaded","Connected","var(--green)"],["OpenAI (GPT-4o)","AI assistant","Connected","var(--green)"]].map(([name, desc, status, color]) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color.replace("var(","").replace(")","") === "--green" ? "var(--green-dim)" : "var(--surface-3)"}`, padding: "3px 10px", borderRadius: 10 }}>{status}</span>
                </div>
              ))}
            </div>
          )}

          {/* EMAIL ALERTS */}
          {stTab === "alerts" && (
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Configure email alerts for data pipeline events.</div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Alert Email</label>
                <input type="email" placeholder="datateamttpservices@gmail.com" style={inputStyle} />
              </div>
              <button style={{ padding: "9px 18px", borderRadius: "var(--radius)", background: "var(--blue)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
              <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)" }}>
                <b style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>Auto-refresh: Daily 00:00 Dubai time</b>
                Dashboard data refreshes automatically every night. Email alerts require SMTP configuration in the backend.
              </div>
            </div>
          )}

          {/* AI PROMPTS */}
          {stTab === "ai_prompts" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>AI System Prompt</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Controls how TTP AI behaves and what data it can access. Changes take effect immediately.</div>
                <textarea defaultValue={`You are TTP AI — analytics assistant for TTP Services (Belgian travel company).
SOURCES: CustomerOverview (Solmar/Interbus/Solmar DE) + ST_Bookings (Snowtravel)
RULES: Never guess. Ask back if ambiguous. Use Dutch number format.`}
                  style={{ width: "100%", minHeight: 180, padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 12, fontFamily: "var(--mono)", resize: "vertical", outline: "none", lineHeight: 1.6 }} />
                <div style={{ marginTop: 8 }}>
                  <button style={{ padding: "8px 16px", borderRadius: "var(--radius)", background: "var(--blue)", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save Prompt</button>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>AI Data Access</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["CustomerOverview (Solmar/Interbus/Solmar DE)",true],["ST_Bookings (Snowtravel)",true],["BUStrips (Pendel)",false],["FeederOverview",false],["HotelRatings",false],["HotelReviews",false]].map(([label, enabled]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: enabled ? "var(--green)" : "var(--text-dim)", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: enabled ? "var(--text)" : "var(--text-muted)" }}>{label}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: enabled ? "var(--green)" : "var(--text-dim)", fontWeight: 600 }}>{enabled ? "Active" : "Inactive"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BUS OCCUPANCY TAB ────────────────────────────────────────────────────────
function BusTab({ token }) {
  const [busSubTab, setBusSubTab] = useState("pendel");
  const [busStatus, setBusStatus] = useState("DEF");
  const [dateFrom, setDateFrom]   = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo]       = useState(`${new Date().getFullYear()}-12-31`);
  const [kpis, setKpis]           = useState(null);
  const [pendel, setPendel]       = useState([]);
  const [feeder, setFeeder]       = useState([]);
  const [deck, setDeck]           = useState([]);
  const [loading, setLoading]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { dateFrom, dateTo, busStatus };
    try {
      const [k, p, f, d] = await Promise.allSettled([
        apiFetch("/api/dashboard/bus-kpis", params),
        apiFetch("/api/dashboard/bus-pendel", { dateFrom, dateTo }),
        apiFetch("/api/dashboard/bus-feeder", { dateFrom, dateTo }),
        apiFetch("/api/dashboard/bus-deck", params),
      ]);
      if (k.status === "fulfilled") setKpis(k.value);
      if (p.status === "fulfilled") setPendel(Array.isArray(p.value) ? p.value : []);
      if (f.status === "fulfilled") setFeeder(Array.isArray(f.value) ? f.value : []);
      if (d.status === "fulfilled") setDeck(Array.isArray(d.value) ? d.value : []);
    } catch {} finally { setLoading(false); }
  }, [dateFrom, dateTo, busStatus]);

  useEffect(() => { load(); }, [load]);

  const KpiMini = ({ label, value, color }) => (
    <div style={{ flex: 1, minWidth: 120, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "var(--text)", fontFamily: "var(--mono)" }}>{value}</div>
    </div>
  );

  return (
    <div className="tab-content">
      {/* Filters */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px", marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 12, outline: "none" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 12, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["DEF","Confirmed","var(--green)"],["TIJD","Temporary","var(--amber)"],["VERV","Cancelled","var(--red)"],["all","All","var(--blue)"]].map(([v, l, c]) => (
            <button key={v} onClick={() => setBusStatus(v)} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${busStatus === v ? c : "var(--border)"}`, background: busStatus === v ? `${c.replace("var(","").replace(")","") === "--green" ? "var(--green-dim)" : c === "var(--amber)" ? "var(--amber-dim)" : c === "var(--red)" ? "var(--red-dim)" : "var(--blue-dim)"}` : "transparent", color: busStatus === v ? c : "var(--text-muted)", fontSize: 12, fontWeight: busStatus === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <button onClick={load} style={{ padding: "7px 16px", borderRadius: "var(--radius)", background: "var(--blue)", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Apply</button>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <KpiMini label="Total PAX"       value={fmtN(kpis.total_pax)}       color="var(--blue)" />
          <KpiMini label="Total Bookings"  value={fmtN(kpis.total_bookings)}   color="var(--text)" />
          <KpiMini label="Royal Class"     value={fmtN(kpis.royal_pax)}        color="var(--purple)" />
          <KpiMini label="First Class"     value={fmtN(kpis.first_pax)}        color="var(--green)" />
          <KpiMini label="Premium"         value={fmtN(kpis.premium_pax)}      color="var(--amber)" />
          <KpiMini label="Confirmed (DEF)" value={fmtN(kpis.confirmed_pax)}    color="var(--green)" />
          <KpiMini label="Temporary (TIJD)"value={fmtN(kpis.temp_pax)}         color="var(--amber)" />
          <KpiMini label="Cancelled (VERV)"value={fmtN(kpis.cancelled_pax)}    color="var(--red)" />
        </div>
      )}

      {/* Sub-tabs: Pendel / Feeder / Deck */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {[["pendel","Pendel Overview"],["feeder","Feeder Overview"],["deck","Deck Choice / Class"]].map(([k, l]) => (
            <button key={k} onClick={() => setBusSubTab(k)} style={{ padding: "11px 18px", background: "none", border: "none", borderBottom: `2px solid ${busSubTab === k ? "var(--blue)" : "transparent"}`, color: busSubTab === k ? "var(--blue)" : "var(--text-muted)", fontSize: 13, fontWeight: busSubTab === k ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
          ))}
          {loading && <span style={{ marginLeft: "auto", padding: "11px 16px", fontSize: 12, color: "var(--text-dim)" }}>Loading…</span>}
        </div>
        {busSubTab === "pendel" && <PendelTable data={pendel} />}
        {busSubTab === "feeder" && <FeederTable data={feeder} />}
        {busSubTab === "deck"   && <DeckTable   data={deck} />}
      </div>
    </div>
  );
}

// ─── FLOATING AI BUTTON ───────────────────────────────────────────────────────
function FloatingAI({ tab, setTab }) {
  const [open, setOpen] = useState(false);
  if (tab === "ai") return null;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 500, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {open && (
        <div style={{ width: 300, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>TTP AI Assistant</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>{Icons.close}</button>
          </div>
          <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>Ask me anything about your data.</div>
          <div style={{ padding: "0 12px 12px", display: "flex", gap: 6 }}>
            <input placeholder="Quick question…" style={{ flex: 1, padding: "7px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 12, outline: "none" }}
              onKeyDown={e => { if (e.key === "Enter") { setTab("ai"); setOpen(false); } }} />
            <button onClick={() => { setTab("ai"); setOpen(false); }} style={{ padding: "7px 12px", background: "var(--blue)", border: "none", borderRadius: "var(--radius)", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Open</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} title="TTP AI Assistant"
        style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--blue)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(77,158,255,0.4)", transition: "transform 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          <circle cx="9" cy="14" r="1" fill="white"/><circle cx="15" cy="14" r="1" fill="white"/>
        </svg>
      </button>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",      icon: Icons.overview },
  { id: "bus",       label: "Bus Occupancy", icon: Icons.bus },
  { id: "hotel",     label: "Hotel Insights",icon: Icons.hotel },
  { id: "data",      label: "Data Table",    icon: Icons.table },
  { id: "ai",        label: "TTP AI",        icon: Icons.ai },
  { id: "settings",  label: "Settings",      icon: Icons.settings },
];
const DATASETS = ["Solmar","Interbus","Solmar DE","Snowtravel"];
const YEARS    = ["2022","2023","2024","2025","2026"];

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const t = localStorage.getItem("ttp_token") || sessionStorage.getItem("ttp_token");
      const u = localStorage.getItem("ttp_user") || sessionStorage.getItem("ttp_user");
      return t && u ? { ...JSON.parse(u), token: t } : null;
    } catch { return null; }
  });

  const [tab, setTab]           = useState("overview");
  const [metric, setMetric]     = useState("bookings");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters]   = useState({ datasets: [], year: [], departureDateFrom: "", departureDateTo: "", status: "" });
  const [applied, setApplied]   = useState({});

  // Data
  const [kpiData,     setKpiData]     = useState(null);
  const [ymData,      setYmData]      = useState([]);
  const [revData,     setRevData]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [spinning,    setSpinning]    = useState(false);
  const [lastSync,    setLastSync]    = useState(null);
  const [error,       setError]       = useState("");

  const handleLogin  = (token, u) => setUser({ ...u, token });
  const handleLogout = () => {
    localStorage.removeItem("ttp_token"); localStorage.removeItem("ttp_user");
    sessionStorage.removeItem("ttp_token"); sessionStorage.removeItem("ttp_user");
    setUser(null);
  };

  const buildParams = f => {
    const p = {};
    if (f.datasets?.length)   p.dataset           = f.datasets;
    if (f.year?.length)       p.year              = f.year;
    if (f.departureDateFrom)  p.departureDateFrom = f.departureDateFrom;
    if (f.departureDateTo)    p.departureDateTo   = f.departureDateTo;
    if (f.status)             p.status            = f.status;
    return p;
  };

  const loadAll = useCallback(async (f = {}, quiet = false) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    setSpinning(true); setError("");
    const p = buildParams(f);
    try {
      const [kpis, ym, rev] = await Promise.allSettled([
        apiFetch("/api/dashboard/kpis", p),
        apiFetch("/api/dashboard/year-month-comparison", p),
        apiFetch("/api/dashboard/revenue-by-year", p),
      ]);
      if (kpis.status === "fulfilled") setKpiData(kpis.value);
      if (ym.status === "fulfilled")   setYmData(Array.isArray(ym.value) ? ym.value : []);
      if (rev.status === "fulfilled")  setRevData(Array.isArray(rev.value) ? rev.value : []);
      setLastSync(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setSpinning(false); }
  }, [user]);

  useEffect(() => { loadAll(applied); }, [applied, loadAll]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => loadAll(applied, true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, applied, loadAll]);

  if (!user) return <Login onLogin={handleLogin} />;

  const hasFilters = applied.datasets?.length || applied.year?.length || applied.departureDateFrom || applied.status;
  const fmtSync = d => d ? `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` : null;

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">TTP</div>
          <div className="brand-info">
            <span className="brand-title">Analytics</span>
            <span className="brand-sub">Data Engine v2.0</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{(user.name || "U")[0].toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          {lastSync && <div className="sync-status"><span className="sync-dot" />Last sync {fmtSync(lastSync)}</div>}
          <button className="btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="main-area">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{TABS.find(t => t.id === tab)?.label}</h1>
            {hasFilters && (
              <div className="active-filters-row">
                {applied.datasets?.map(d => <span key={d} className="filter-chip dataset">{d}</span>)}
                {applied.year?.map(y => <span key={y} className="filter-chip year">{y}</span>)}
                {applied.departureDateFrom && <span className="filter-chip date">{applied.departureDateFrom} → {applied.departureDateTo}</span>}
                {applied.status && <span className="filter-chip status">{applied.status}</span>}
                <button className="chip-clear" onClick={() => { setFilters({ datasets: [], year: [], departureDateFrom: "", departureDateTo: "", status: "" }); setApplied({}); }}>Clear</button>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            {tab === "overview" && (
              <div className="metric-tabs">
                {[["bookings","Bookings"],["pax","PAX"],["revenue","Revenue"]].map(([id, label]) => (
                  <button key={id} className={`metric-tab ${metric === id ? "active" : ""}`} onClick={() => setMetric(id)}>{label}</button>
                ))}
              </div>
            )}
            <button className={`btn-icon ${spinning ? "spinning" : ""}`} onClick={() => loadAll(applied, true)} title="Refresh">
              {Icons.refresh}
            </button>
            <button className={`btn-filter ${filtersOpen ? "active" : ""} ${hasFilters ? "has-active" : ""}`} onClick={() => setFiltersOpen(o => !o)}>
              {Icons.filter} Filters {hasFilters && <span className="filter-badge" />}
            </button>
          </div>
        </header>

        {/* FILTER DRAWER */}
        <div className={`filter-drawer ${filtersOpen ? "open" : ""}`}>
          <div className="filter-drawer-inner">
            <div className="filter-section">
              <label className="filter-label">Dataset</label>
              <div className="chip-group">
                {DATASETS.map(ds => (
                  <button key={ds} className={`ds-chip ${filters.datasets?.includes(ds) ? "active" : ""}`}
                    onClick={() => setFilters(f => ({ ...f, datasets: f.datasets?.includes(ds) ? f.datasets.filter(x => x !== ds) : [...(f.datasets||[]), ds] }))}>
                    {ds}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <label className="filter-label">Year</label>
              <div className="chip-group">
                {YEARS.map(y => (
                  <button key={y} className={`ds-chip ${filters.year?.includes(y) ? "active" : ""}`}
                    onClick={() => setFilters(f => ({ ...f, year: f.year?.includes(y) ? f.year.filter(x => x !== y) : [...(f.year||[]), y] }))}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <label className="filter-label">Departure Date</label>
              <div className="date-range">
                <input type="date" className="date-input" value={filters.departureDateFrom || ""} onChange={e => setFilters(f => ({ ...f, departureDateFrom: e.target.value }))} />
                <span className="date-sep">→</span>
                <input type="date" className="date-input" value={filters.departureDateTo || ""} onChange={e => setFilters(f => ({ ...f, departureDateTo: e.target.value }))} />
              </div>
            </div>
            <div className="filter-section">
              <label className="filter-label">Status</label>
              <div className="chip-group">
                {[{v:"",l:"All"},{v:"ok",l:"Confirmed"},{v:"cancelled",l:"Cancelled"}].map(s => (
                  <button key={s.v} className={`ds-chip ${(filters.status || "") === s.v ? "active" : ""}`} onClick={() => setFilters(f => ({ ...f, status: s.v }))}>{s.l}</button>
                ))}
              </div>
            </div>
            <div className="filter-actions">
              <button className="btn-clear-filters" onClick={() => setFilters({ datasets: [], year: [], departureDateFrom: "", departureDateTo: "", status: "" })}>Clear</button>
              <button className="btn-apply-filters" onClick={() => { setApplied({ ...filters }); setFiltersOpen(false); }}>Apply Filters</button>
            </div>
          </div>
        </div>

        {/* PAGE BODY */}
        <main className="page-body">
          {error && <div className="error-banner"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
          {loading && <div className="loading-bar"><div className="loading-bar-fill" /></div>}

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="tab-content">
              {/* Period badge */}
              {kpiData?.periodLabel && (
                <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Showing:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--blue-dim)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(77,158,255,0.3)" }}>{kpiData.periodLabel}</span>
                  {hasFilters && <button onClick={() => { setFilters({ datasets: [], year: [], departureDateFrom: "", departureDateTo: "", status: "" }); setApplied({}); }} style={{ fontSize: 11, color: "var(--amber)", background: "var(--amber-dim)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>✕ Reset filters</button>}
                </div>
              )}

              {/* KPI Cards */}
              <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                <KpiCard label="Total Bookings" curr={kpiData?.currentBookings} prev={kpiData?.previousBookings} diff={kpiData?.differenceBookings} pct={kpiData?.percentBookings} fmt={fmtN} color="var(--blue)" prevLabel={kpiData?.prevLabel} />
                <KpiCard label="Total PAX" curr={kpiData?.currentPax} prev={kpiData?.previousPax} diff={kpiData?.differencePax} pct={kpiData?.percentPax} fmt={fmtN} color="var(--green)" prevLabel={kpiData?.prevLabel} />
                <KpiCard label="Gross Revenue" curr={kpiData?.currentRevenue} prev={kpiData?.previousRevenue} diff={kpiData?.differenceRevenue} pct={kpiData?.percentRevenue} fmt={fmtEur} color="var(--amber)" prevLabel={kpiData?.prevLabel} />
              </div>

              {/* Charts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 16px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Revenue by Year</div>
                  <LineChart data={revData} />
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 16px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Bookings / PAX by Year</span>
                  </div>
                  <BarChart data={revData} metric={metric} />
                </div>
              </div>

              {/* YM Table */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flex: 1 }}>Year-Month Comparison</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--bg-2)", padding: "2px 8px", borderRadius: 10, border: "1px solid var(--border)" }}>← scroll →</span>
                  {[["bookings","Bookings"],["pax","PAX"],["revenue","Revenue"]].map(([id, l]) => (
                    <button key={id} onClick={() => setMetric(id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${metric === id ? "var(--blue)" : "var(--border)"}`, background: metric === id ? "var(--blue)" : "transparent", color: metric === id ? "#fff" : "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                  ))}
                </div>
                <YearMonthTable data={ymData} metric={metric} />
              </div>
            </div>
          )}

          {tab === "bus"      && <BusTab token={user.token} />}
          {tab === "hotel"    && <HotelTab token={user.token} />}
          {tab === "data"     && <DataTableTab token={user.token} applied={applied} />}
          {tab === "ai"       && <AiTab user={user} kpiData={kpiData} />}
          {tab === "settings" && user.role === "admin" && <SettingsTab token={user.token} user={user} />}
          {tab === "settings" && user.role !== "admin" && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Admin Access Required</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Contact your administrator to access settings.</div>
            </div>
          )}
        </main>

        {/* STATUS BAR */}
        <div style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border)", padding: "4px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)" }}>Last sync: <span style={{ color: "var(--blue)", fontWeight: 600 }}>{fmtSync(lastSync) || "—"}</span> Dubai</span>
            {[["Solmar","Live"],["Snowtravel","Live"],["Interbus","Live"],["Solmar DE","Live"]].map(([k, v]) => (
              <span key={k} style={{ color: "var(--text-dim)" }}><span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{k}</span>: <span style={{ color: "var(--green)" }}>{v}</span></span>
            ))}
          </div>
          <span style={{ color: "var(--text-dim)" }}>TTP Analytics v2.1 · <span style={{ color: "var(--green)" }}>●</span> Live</span>
        </div>
      </div>

      <FloatingAI tab={tab} setTab={setTab} />

      <style>{`
        @keyframes typingDot { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .tab-content { display:flex; flex-direction:column; gap:16px; }
        .loading-bar { height:3px; background:var(--surface); overflow:hidden; }
        .loading-bar-fill { height:100%; width:40%; background:linear-gradient(90deg,var(--blue),var(--green)); animation:slideBar 1.2s ease infinite; }
        @keyframes slideBar { from{transform:translateX(-100%)} to{transform:translateX(350%)} }
        .error-banner { display:flex; align-items:center; gap:8px; padding:10px 14px; background:var(--red-dim); border:1px solid rgba(248,113,113,.3); border-radius:var(--radius); font-size:13px; color:var(--red); }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity:.5; cursor:pointer; filter:invert(1); }
        select option { background:var(--surface); color:var(--text); }
        @media (max-width:768px) {
          .sidebar { position:fixed; bottom:0; left:0; width:100%; height:52px; flex-direction:row; z-index:100; border-right:none; border-top:1px solid var(--border); }
          .sidebar-brand, .sidebar-footer { display:none; }
          .sidebar-nav { flex-direction:row; padding:0 8px; overflow-x:auto; }
          .nav-item { flex-direction:column; gap:2px; padding:6px 10px; font-size:10px; }
          .main-area { padding-bottom:52px; }
        }
      `}</style>
    </div>
  );
}
