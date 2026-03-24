import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./components/Login.jsx";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#3b82f6","#10b981","#f59e0b","#ec4899"];
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

// ── THEME ─────────────────────────────────────────────────────────────────────
const THEMES = {
  gray: {
    id: "gray", name: "Professional Gray",
    bg: "#f3f4f6", sidebar: "#ffffff", card: "#ffffff",
    border: "#e5e7eb", accent: "#0033cc", accentLight: "#eff2ff",
    text: "#111827", textSub: "#374151", muted: "#6b7280", muted2: "#9ca3af",
    success: "#16a34a", successBg: "#f0fdf4", danger: "#dc2626", dangerBg: "#fef2f2",
    warning: "#d97706", warningBg: "#fffbeb", tableHead: "#f9fafb",
    tableRow: "#ffffff", tableRowAlt: "#f9fafb", tableHover: "#eff2ff",
    inputBg: "#ffffff", shadow: "0 1px 3px rgba(0,0,0,0.08)",
    shadowMd: "0 4px 12px rgba(0,0,0,0.08)", badge: "#e5e7eb", badgeText: "#374151",
  },
  dark: {
    id: "dark", name: "Dark Navy",
    bg: "#0d1117", sidebar: "#161b22", card: "#21262d",
    border: "#30363d", accent: "#58a6ff", accentLight: "#1f3a6e",
    text: "#e6edf3", textSub: "#b1bac4", muted: "#8b949e", muted2: "#6e7681",
    success: "#3fb950", successBg: "#1a2e1d", danger: "#f85149", dangerBg: "#2d1215",
    warning: "#d29922", warningBg: "#2d2011", tableHead: "#161b22",
    tableRow: "#21262d", tableRowAlt: "#1c2129", tableHover: "#1f3a6e",
    inputBg: "#161b22", shadow: "0 1px 3px rgba(0,0,0,0.4)",
    shadowMd: "0 4px 12px rgba(0,0,0,0.5)", badge: "#30363d", badgeText: "#b1bac4",
  }
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const dubaiTime = () => new Date().toLocaleString("en-GB", { timeZone: "Asia/Dubai", hour:"2-digit", minute:"2-digit" });
const fmtEur = v => "\u20AC" + Math.round(v||0).toLocaleString("nl-BE");
const fmtNum = v => Math.round(v||0).toLocaleString("nl-BE");
const fmtPct = v => (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%";
const calcPct = (a, b) => b ? ((a - b) / b * 100) : (a ? 100 : 0);
const monthLabel = (m, y) => `${MONTHS[(m||1)-1]}-${y}`;

// ── API ───────────────────────────────────────────────────────────────────────
async function apiFetch(path, params = {}) {
  const token = localStorage.getItem("ttp_token");
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
    else if (v !== "" && v != null) url.searchParams.set(k, v);
  });
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return r.json();
}

function buildParams(f = {}) {
  const p = {};
  if (f.datasets?.length)       p.dataset = f.datasets;
  if (f.statuses?.length)        p.status  = f.statuses;
  if (f.transportTypes?.length)  p.transportType = f.transportTypes;
  if (f.departureDateFrom)       p.departureDateFrom = f.departureDateFrom;
  if (f.departureDateTo)         p.departureDateTo   = f.departureDateTo;
  if (f.bookingDateFrom)         p.bookingDateFrom   = f.bookingDateFrom;
  if (f.bookingDateTo)           p.bookingDateTo     = f.bookingDateTo;
  return p;
}

// ── CANVAS CHARTS ─────────────────────────────────────────────────────────────
function LineChart({ data, T }) {
  const ref = useRef();
  const ptsRef = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { top: 24, right: 24, bottom: 36, left: 64 };

    const byYear = {};
    data.forEach(r => {
      if (!byYear[r.year]) byYear[r.year] = {};
      byYear[r.year][r.month] = r.revenue || 0;
    });
    const years = Object.keys(byYear).map(Number).sort((a,b) => a-b);
    const allVals = data.map(r => r.revenue || 0);
    const maxV = Math.max(...allVals, 1);

    ctx.fillStyle = T.card;
    ctx.fillRect(0, 0, W, H);

    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const scaleX = m => pad.left + ((m - 1) / 11) * cW;
    const scaleY = v => pad.top + cH - (v / maxV) * cH;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i;
      ctx.strokeStyle = T.border;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      const val = maxV - (maxV / 4) * i;
      ctx.fillStyle = T.muted;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(val >= 1e6 ? (val/1e6).toFixed(1)+"M" : val >= 1e3 ? (val/1e3).toFixed(0)+"K" : val.toFixed(0), pad.left - 4, y + 3);
    }

    // Month labels
    ctx.fillStyle = T.muted;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    MONTHS.forEach((m, i) => ctx.fillText(m, scaleX(i+1), H - pad.bottom + 14));

    ptsRef.current = [];
    years.forEach((y, yi) => {
      const color = YEAR_COLORS[yi % YEAR_COLORS.length];
      const pts = Array.from({length:12}, (_, i) => ({ x: scaleX(i+1), y: scaleY(byYear[y][i+1]||0), month: i+1, year: y, val: byYear[y][i+1]||0 })).filter(p => p.val > 0);
      if (!pts.length) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();

      pts.forEach(p => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ptsRef.current.push(p);
      });
    });

    // Legend
    let lx = pad.left;
    years.forEach((y, yi) => {
      ctx.fillStyle = YEAR_COLORS[yi % YEAR_COLORS.length];
      ctx.fillRect(lx, 6, 12, 8);
      ctx.fillStyle = T.muted;
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(y, lx + 15, 13);
      lx += 48;
    });
  }, [data, T]);

  const onMove = useCallback(e => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let near = null, minD = 20;
    ptsRef.current.forEach(p => {
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < minD) { minD = d; near = p; }
    });
    setTip(near ? { x: e.clientX, y: e.clientY, ...near } : null);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={ref} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ width: "100%", height: 220, display: "block", cursor: "crosshair" }} />
      {tip && (
        <div style={{ position: "fixed", left: tip.x + 12, top: tip.y - 44, background: "#1e293b",
          border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 12,
          color: "#f1f5f9", pointerEvents: "none", zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>{MONTHS[(tip.month||1)-1]} {tip.year}</div>
          <div>{fmtEur(tip.val)}</div>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, metric, T }) {
  const ref = useRef();
  const barsRef = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { top: 24, right: 24, bottom: 36, left: 56 };

    const byYear = {};
    data.forEach(r => {
      if (!byYear[r.year]) byYear[r.year] = {};
      byYear[r.year][r.month] = r[metric] || 0;
    });
    const years = Object.keys(byYear).map(Number).sort((a,b) => a-b);
    const allVals = data.map(r => r[metric] || 0);
    const maxV = Math.max(...allVals, 1);

    ctx.fillStyle = T.card;
    ctx.fillRect(0, 0, W, H);

    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const slotW = cW / 12;
    const bW = Math.min(14, (slotW - 4) / years.length);
    const sy = v => pad.top + cH - (v / maxV) * cH;

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i;
      ctx.strokeStyle = T.border;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      const val = maxV - (maxV / 4) * i;
      ctx.fillStyle = T.muted;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(val >= 1e6 ? (val/1e6).toFixed(1)+"M" : val >= 1e3 ? (val/1e3).toFixed(0)+"K" : val.toFixed(0), pad.left - 4, y + 3);
    }

    ctx.fillStyle = T.muted;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    MONTHS.forEach((m, i) => ctx.fillText(m, pad.left + i * slotW + slotW / 2, H - pad.bottom + 14));

    barsRef.current = [];
    years.forEach((y, yi) => {
      const color = YEAR_COLORS[yi % YEAR_COLORS.length];
      ctx.fillStyle = color + "cc";
      Array.from({length:12}, (_, i) => i+1).forEach(m => {
        const v = byYear[y][m] || 0;
        if (!v) return;
        const x = pad.left + (m-1) * slotW + yi * (bW + 2) + (slotW - years.length * (bW + 2)) / 2;
        const bH = (v / maxV) * cH;
        ctx.fillRect(x, sy(v), bW, bH);
        barsRef.current.push({ x, y: sy(v), width: bW, height: bH, year: y, month: m, val: v });
      });
    });

    let lx = pad.left;
    years.forEach((y, yi) => {
      ctx.fillStyle = YEAR_COLORS[yi % YEAR_COLORS.length];
      ctx.fillRect(lx, 6, 12, 8);
      ctx.fillStyle = T.muted;
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(y, lx + 15, 13);
      lx += 48;
    });
  }, [data, metric, T]);

  const onMove = useCallback(e => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const bar = barsRef.current.find(b => mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height);
    setTip(bar ? { x: e.clientX, y: e.clientY, ...bar } : null);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={ref} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ width: "100%", height: 220, display: "block", cursor: "crosshair" }} />
      {tip && (
        <div style={{ position: "fixed", left: tip.x + 12, top: tip.y - 44, background: "#1e293b",
          border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 12,
          color: "#f1f5f9", pointerEvents: "none", zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>{MONTHS[(tip.month||1)-1]} {tip.year}</div>
          <div>{metric === "revenue" ? fmtEur(tip.val) : fmtNum(tip.val) + (metric === "pax" ? " PAX" : " bookings")}</div>
        </div>
      )}
    </div>
  );
}

function BusClassChart({ data, metric, label, T }) {
  const ref = useRef();
  const barsRef = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { top: 24, right: 24, bottom: 60, left: 60 };

    const classes = [...new Set(data.map(d => d.bus_class))].filter(Boolean);
    const datasets = [...new Set(data.map(d => d.dataset))].filter(Boolean);
    const dsColors = { Solmar: "#3b82f6", Interbus: "#10b981", "Solmar DE": "#f59e0b", Snowtravel: "#8b5cf6" };

    const grouped = {};
    classes.forEach(c => { grouped[c] = {}; datasets.forEach(ds => { grouped[c][ds] = 0; }); });
    data.forEach(d => { if (grouped[d.bus_class]) grouped[d.bus_class][d.dataset] = d[metric] || 0; });

    const maxV = Math.max(...classes.flatMap(c => datasets.map(ds => grouped[c][ds])), 1);
    ctx.fillStyle = T.card;
    ctx.fillRect(0, 0, W, H);

    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const slotW = cW / classes.length;
    const bW = Math.min(28, (slotW - 8) / datasets.length);
    const sy = v => pad.top + cH - (v / maxV) * cH;

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i;
      ctx.strokeStyle = T.border; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      const val = maxV - (maxV / 4) * i;
      ctx.fillStyle = T.muted; ctx.font = "10px system-ui"; ctx.textAlign = "right";
      ctx.fillText(metric === "revenue" ? (val>=1e6?(val/1e6).toFixed(1)+"M":val>=1e3?(val/1e3).toFixed(0)+"K":val.toFixed(0)) : fmtNum(val), pad.left - 4, y + 3);
    }

    barsRef.current = [];
    classes.forEach((c, ci) => {
      const slotX = pad.left + ci * slotW;
      datasets.forEach((ds, di) => {
        const v = grouped[c][ds];
        if (!v) return;
        const color = dsColors[ds] || "#94a3b8";
        const x = slotX + di * (bW + 3) + (slotW - datasets.length * (bW + 3)) / 2;
        const bH = (v / maxV) * cH;
        ctx.fillStyle = color + "dd";
        ctx.fillRect(x, sy(v), bW, bH);
        barsRef.current.push({ x, y: sy(v), width: bW, height: bH, class: c, dataset: ds, val: v });
      });
      ctx.fillStyle = T.muted; ctx.font = "11px system-ui"; ctx.textAlign = "center";
      ctx.fillText(c, slotX + slotW / 2, H - pad.bottom + 14);
    });

    let lx = pad.left;
    datasets.forEach(ds => {
      ctx.fillStyle = dsColors[ds] || "#94a3b8";
      ctx.fillRect(lx, 6, 12, 8);
      ctx.fillStyle = T.muted; ctx.font = "10px system-ui"; ctx.textAlign = "left";
      ctx.fillText(ds, lx + 15, 13);
      lx += ds.length * 7 + 24;
    });
  }, [data, metric, T]);

  const onMove = useCallback(e => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const bar = barsRef.current.find(b => mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height);
    setTip(bar ? { x: e.clientX, y: e.clientY, ...bar } : null);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={ref} onMouseMove={onMove} onMouseLeave={() => setTip(null)}
        style={{ width: "100%", height: 220, display: "block", cursor: "crosshair" }} />
      {tip && (
        <div style={{ position: "fixed", left: tip.x + 12, top: tip.y - 44, background: "#1e293b",
          border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 12,
          color: "#f1f5f9", pointerEvents: "none", zIndex: 9999 }}>
          <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>{tip.class} · {tip.dataset}</div>
          <div>{metric === "revenue" ? fmtEur(tip.val) : fmtNum(tip.val) + (metric === "pax" ? " PAX" : " bookings")}</div>
        </div>
      )}
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function Card({ children, T, style = {} }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
      boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", T, style = {}, disabled = false }) {
  const styles = {
    primary: { background: T.accent, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
    danger: { background: T.danger, color: "#fff", border: "none" },
    success: { background: T.success, color: "#fff", border: "none" },
    ghost: { background: T.accentLight, color: T.accent, border: `1px solid ${T.accent}20` },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], borderRadius: 6, padding: "7px 14px", fontSize: 13,
        fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      {children}
    </button>
  );
}

function StatusBadge({ status, T }) {
  const isOk = status?.toLowerCase() === "ok";
  const isCancelled = status?.toLowerCase() === "cancelled";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: isOk ? T.successBg : isCancelled ? T.dangerBg : T.badge,
      color: isOk ? T.success : isCancelled ? T.danger : T.muted,
    }}>{status}</span>
  );
}

function Input({ value, onChange, placeholder, T, style = {}, type = "text" }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
        padding: "7px 10px", fontSize: 13, outline: "none", width: "100%", ...style }} />
  );
}

function Select({ value, onChange, options, T, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
        padding: "7px 10px", fontSize: 13, outline: "none", cursor: "pointer", ...style }}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function MultiSelect({ label, options, selected, onChange, T }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const display = selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 140 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
          padding: "7px 10px", fontSize: 13, cursor: "pointer", width: "100%", textAlign: "left",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: selected.length ? T.text : T.muted }}>{display}</span>
        <span style={{ color: T.muted, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "100%",
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.shadowMd,
          zIndex: 200, padding: 4, maxHeight: 220, overflowY: "auto" }}>
          <div style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, color: T.muted,
            borderRadius: 4, display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => onChange([])}>
            <span style={{ color: T.accent, fontSize: 11 }}>{selected.length === 0 ? "✓" : " "}</span>
            All
          </div>
          {options.map(o => (
            <div key={o} style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, color: T.text,
              borderRadius: 4, display: "flex", alignItems: "center", gap: 8,
              background: selected.includes(o) ? T.accentLight : "transparent" }}
              onClick={() => onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o])}>
              <span style={{ color: T.accent, fontSize: 11 }}>{selected.includes(o) ? "✓" : " "}</span>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FILTERS BAR ───────────────────────────────────────────────────────────────
function FiltersBar({ filters, setFilters, onApply, onReset, slicers, T }) {
  const today = new Date().toISOString().split("T")[0];
  const y = new Date().getFullYear();
  const presets = [
    { label: "This Year", from: `${y}-01-01`, to: `${y}-12-31` },
    { label: "Last Year", from: `${y-1}-01-01`, to: `${y-1}-12-31` },
    { label: "Last 3M",   from: new Date(new Date().setMonth(new Date().getMonth()-3)).toISOString().split("T")[0], to: today },
    { label: "All",       from: "", to: "" },
  ];
  return (
    <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "10px 24px",
      display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>

      {/* Date presets */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Select</div>
        <div style={{ display: "flex", gap: 4 }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => {
              setFilters(f => ({ ...f, departureDateFrom: p.from, departureDateTo: p.to }));
              setTimeout(onApply, 60);
            }} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, color: T.muted,
              padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Departure date */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Departure Date</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="date" value={filters.departureDateFrom || ""} onChange={e => setFilters(f => ({ ...f, departureDateFrom: e.target.value }))}
            style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 8px", fontSize: 12, colorScheme: T.id === "dark" ? "dark" : "light" }} />
          <span style={{ color: T.muted, fontSize: 11 }}>to</span>
          <input type="date" value={filters.departureDateTo || ""} onChange={e => setFilters(f => ({ ...f, departureDateTo: e.target.value }))}
            style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 8px", fontSize: 12, colorScheme: T.id === "dark" ? "dark" : "light" }} />
        </div>
      </div>

      {/* Booking date */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Booking Date</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="date" value={filters.bookingDateFrom || ""} onChange={e => setFilters(f => ({ ...f, bookingDateFrom: e.target.value }))}
            style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 8px", fontSize: 12, colorScheme: T.id === "dark" ? "dark" : "light" }} />
          <span style={{ color: T.muted, fontSize: 11 }}>to</span>
          <input type="date" value={filters.bookingDateTo || ""} onChange={e => setFilters(f => ({ ...f, bookingDateTo: e.target.value }))}
            style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 8px", fontSize: 12, colorScheme: T.id === "dark" ? "dark" : "light" }} />
        </div>
      </div>

      {/* Dataset */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dataset</div>
        <MultiSelect label="Dataset" options={slicers?.datasets || ["Snowtravel","Solmar","Interbus","Solmar DE"]}
          selected={filters.datasets || []} onChange={v => setFilters(f => ({ ...f, datasets: v }))} T={T} />
      </div>

      {/* Transport */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Transport</div>
        <MultiSelect label="Transport" options={slicers?.transportTypes || ["bus","own transport","plane"]}
          selected={filters.transportTypes || []} onChange={v => setFilters(f => ({ ...f, transportTypes: v }))} T={T} />
      </div>

      {/* Status */}
      <div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["", "All", T.muted, T.border], ["ok", "OK", T.success, T.success], ["cancelled", "Cancelled", T.danger, T.danger]].map(([v, l, col, bdr]) => {
            const active = v === "" ? !(filters.statuses?.length) : (filters.statuses || []).includes(v);
            return (
              <button key={v} onClick={() => setFilters(f => ({ ...f, statuses: v ? [v] : [] }))}
                style={{ background: active ? (v === "ok" ? T.successBg : v === "cancelled" ? T.dangerBg : T.accentLight) : T.inputBg,
                  border: `1px solid ${active ? bdr : T.border}`, borderRadius: 6, color: active ? col : T.muted,
                  padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400 }}>{l}</button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
        <Btn onClick={onApply} T={T}>Apply</Btn>
        <Btn onClick={onReset} variant="secondary" T={T}>Reset</Btn>
      </div>
    </div>
  );
}

// ── KPI CARD ──────────────────────────────────────────────────────────────────
function KpiCard({ title, current, previous, icon, T, format = "number" }) {
  const diff = (current || 0) - (previous || 0);
  const p = calcPct(current || 0, previous || 0);
  const up = diff >= 0;
  const fmt = v => format === "currency" ? fmtEur(v) : fmtNum(v);

  return (
    <Card T={T} style={{ flex: 1, padding: "20px 24px", minWidth: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: T.accentLight, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1, marginBottom: 8 }}>{fmt(current)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ color: T.muted }}>vs {fmt(previous)}</span>
        <span style={{ color: up ? T.success : T.danger, fontWeight: 700, background: up ? T.successBg : T.dangerBg,
          padding: "2px 6px", borderRadius: 6 }}>{up ? "▲" : "▼"} {Math.abs(p).toFixed(1)}%</span>
      </div>
    </Card>
  );
}

// ── TRANSPORT BAR ─────────────────────────────────────────────────────────────
function TransportBar({ data, T }) {
  if (!data?.length) return null;
  const norm = data.reduce((acc, item) => {
    const key = (item.transport_type || "").toLowerCase().replace("owntransport", "own transport").trim() || "other";
    const ex = acc.find(x => x.key === key);
    if (ex) { ex.bookings += (item.bookings || 0); }
    else acc.push({ key, label: key, bookings: item.bookings || 0 });
    return acc;
  }, []);
  const total = norm.reduce((s, x) => s + x.bookings, 0);
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
        {norm.map((x, i) => (
          <div key={x.key} style={{ width: `${(x.bookings/total*100).toFixed(1)}%`, background: colors[i % colors.length] }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {norm.map((x, i) => (
          <div key={x.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], display: "inline-block" }} />
            <span style={{ textTransform: "capitalize" }}>{x.label}</span>
            <span style={{ fontWeight: 600, color: T.text }}>{(x.bookings/total*100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({ T, applied, onUnauth }) {
  const [kpis, setKpis] = useState(null);
  const [revData, setRevData] = useState([]);
  const [ymData, setYmData] = useState([]);
  const [trData, setTrData] = useState([]);
  const [barMetric, setBarMetric] = useState("bookings");
  const [loading, setLoading] = useState(false);
  const [ymPage, setYmPage] = useState(0);
  const YM_PAGE_SIZE = 15;

  useEffect(() => {
    const p = buildParams(applied);
    setLoading(true);
    Promise.all([
      apiFetch("/api/dashboard/kpis", p),
      apiFetch("/api/dashboard/revenue-by-year", p),
      apiFetch("/api/dashboard/year-month-comparison", p),
      apiFetch("/api/dashboard/transport-breakdown", p).catch(() => []),
    ]).then(([k, r, ym, tr]) => {
      if (k && !k.error) setKpis(k);
      if (Array.isArray(r)) setRevData(r);
      if (Array.isArray(ym)) { setYmData(ym); setYmPage(0); }
      if (Array.isArray(tr)) setTrData(tr);
    }).catch(e => { if (e.status === 401) onUnauth(); })
      .finally(() => setLoading(false));
  }, [applied]);

  const ymRows = ymData.slice(ymPage * YM_PAGE_SIZE, (ymPage + 1) * YM_PAGE_SIZE);
  const ymPages = Math.ceil(ymData.length / YM_PAGE_SIZE);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {loading && <div style={{ textAlign: "center", color: T.muted, padding: 12, fontSize: 13 }}>Loading data...</div>}

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KpiCard title="Bookings" icon="📋" current={kpis?.currentBookings} previous={kpis?.previousBookings} T={T} />
        <KpiCard title="PAX" icon="👥" current={kpis?.currentPax} previous={kpis?.previousPax} T={T} />
        <KpiCard title="Revenue" icon="💰" current={kpis?.currentRevenue} previous={kpis?.previousRevenue} T={T} format="currency" />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card T={T} style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>Revenue by Year</div>
          <LineChart data={revData} T={T} />
        </Card>
        <Card T={T} style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub }}>
              {barMetric === "bookings" ? "Bookings" : "PAX"} by Year
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["bookings","pax"].map(m => (
                <button key={m} onClick={() => setBarMetric(m)}
                  style={{ background: barMetric === m ? T.accent : T.bg, color: barMetric === m ? "#fff" : T.muted,
                    border: `1px solid ${barMetric === m ? T.accent : T.border}`, borderRadius: 6,
                    padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, textTransform: "capitalize" }}>{m}</button>
              ))}
            </div>
          </div>
          <BarChart data={revData} metric={barMetric} T={T} />
        </Card>
      </div>

      {/* Transport bar + Year-Month table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        <Card T={T} style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 16 }}>Transport Mix</div>
          <TransportBar data={trData} T={T} />
        </Card>
        <Card T={T} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub }}>Year-Month Comparison</div>
            <div style={{ fontSize: 12, color: T.muted }}>{ymData.length} rows</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.tableHead }}>
                  {["Period","Bookings","Prev Bkg","Δ Bkg","PAX","Prev PAX","Δ PAX","Revenue","Prev Rev","Δ Rev"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Period" ? "left" : "right",
                      fontWeight: 600, fontSize: 11, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.05em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ymRows.map((row, i) => {
                  const bDiff = (row.currentBookings||0) - (row.previousBookings||0);
                  const pDiff = (row.currentPax||0) - (row.previousPax||0);
                  const rDiff = (row.currentRevenue||0) - (row.previousRevenue||0);
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? T.tableRow : T.tableRowAlt,
                      borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>
                        {monthLabel(row.month, row.year)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: T.text }}>{fmtNum(row.currentBookings)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: T.muted }}>{fmtNum(row.previousBookings)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: bDiff >= 0 ? T.success : T.danger, fontWeight: 600 }}>{bDiff >= 0 ? "+" : ""}{fmtNum(bDiff)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: T.text }}>{fmtNum(row.currentPax)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: T.muted }}>{fmtNum(row.previousPax)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: pDiff >= 0 ? T.success : T.danger, fontWeight: 600 }}>{pDiff >= 0 ? "+" : ""}{fmtNum(pDiff)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: T.text }}>{fmtEur(row.currentRevenue)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: T.muted }}>{fmtEur(row.previousRevenue)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: rDiff >= 0 ? T.success : T.danger, fontWeight: 600 }}>{rDiff >= 0 ? "+" : ""}{fmtEur(rDiff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ymPages > 1 && (
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Btn onClick={() => setYmPage(p => Math.max(0, p-1))} disabled={ymPage === 0} variant="secondary" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Prev</Btn>
              <span style={{ fontSize: 12, color: T.muted, alignSelf: "center" }}>{ymPage+1} / {ymPages}</span>
              <Btn onClick={() => setYmPage(p => Math.min(ymPages-1, p+1))} disabled={ymPage >= ymPages-1} variant="secondary" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Next</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── BUS OCCUPANCY TAB ─────────────────────────────────────────────────────────
function BusOccupancyTab({ T, onUnauth }) {
  const [mode, setMode] = useState("solmar"); // "solmar" | "snowtravel"
  const [busClass, setBusClass] = useState([]);
  const [busTrips, setBusTrips] = useState([]);
  const [stData, setStData] = useState([]);
  const [stMonthly, setStMonthly] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classMetric, setClassMetric] = useState("bookings");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tripPage, setTripPage] = useState(0);
  const TRIP_PAGE = 30;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/dashboard/bus-class-summary"),
      apiFetch("/api/dashboard/bustrips"),
      apiFetch("/api/dashboard/snowtravel-bus").catch(() => []),
      apiFetch("/api/dashboard/snowtravel-monthly").catch(() => []),
    ]).then(([bc, bt, st, stm]) => {
      if (Array.isArray(bc)) setBusClass(bc);
      const rows = Array.isArray(bt) ? bt : (bt?.rows || []);
      setBusTrips(rows);
      if (Array.isArray(st)) setStData(st);
      if (Array.isArray(stm)) setStMonthly(stm);
    }).catch(e => { if (e.status === 401) onUnauth(); })
      .finally(() => setLoading(false));
  }, []);

  const applyBusFilter = () => {
    const p = {};
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    setLoading(true);
    Promise.all([
      apiFetch("/api/dashboard/bustrips", p),
      apiFetch("/api/dashboard/snowtravel-bus", p).catch(() => []),
    ]).then(([bt, st]) => {
      const rows = Array.isArray(bt) ? bt : (bt?.rows || []);
      setBusTrips(rows); setTripPage(0);
      if (Array.isArray(st)) setStData(st);
    }).finally(() => setLoading(false));
  };

  const solmarClass = busClass.filter(d => ["Solmar","Interbus","Solmar DE"].includes(d.dataset));
  const stClass = busClass.filter(d => d.dataset === "Snowtravel");
  const trips = busTrips.slice(tripPage * TRIP_PAGE, (tripPage+1) * TRIP_PAGE);
  const tripPages = Math.ceil(busTrips.length / TRIP_PAGE);

  const diffColor = v => Number(v) >= 0 ? T.success : T.danger;
  const diffBg = v => Number(v) >= 0 ? T.successBg : T.dangerBg;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toggle + Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1px solid ${T.border}` }}>
          {[["solmar","Solmar / Interbus"],["snowtravel","Snowtravel"]].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{ background: mode === v ? T.accent : "transparent", color: mode === v ? "#fff" : T.muted,
                border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 8px", fontSize: 12, colorScheme: T.id === "dark" ? "dark" : "light" }} />
          <span style={{ color: T.muted, fontSize: 11 }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "6px 8px", fontSize: 12, colorScheme: T.id === "dark" ? "dark" : "light" }} />
          <Btn onClick={applyBusFilter} T={T} style={{ padding: "7px 14px" }}>Apply</Btn>
          <Btn onClick={() => { setDateFrom(""); setDateTo(""); }} variant="secondary" T={T} style={{ padding: "7px 14px" }}>Reset</Btn>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", color: T.muted, padding: 12, fontSize: 13 }}>Loading...</div>}

      {mode === "solmar" && (
        <>
          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card T={T} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub }}>
                  {classMetric === "bookings" ? "Bookings" : "PAX"} by Bus Class
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["bookings","pax"].map(m => (
                    <button key={m} onClick={() => setClassMetric(m)}
                      style={{ background: classMetric === m ? T.accent : T.bg, color: classMetric === m ? "#fff" : T.muted,
                        border: `1px solid ${classMetric === m ? T.accent : T.border}`, borderRadius: 6,
                        padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, textTransform: "capitalize" }}>{m}</button>
                  ))}
                </div>
              </div>
              <BusClassChart data={solmarClass} metric={classMetric} T={T} />
            </Card>
            <Card T={T} style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>Revenue by Bus Class</div>
              <BusClassChart data={solmarClass} metric="revenue" T={T} />
            </Card>
          </div>

          {/* Bus Occupancy Table */}
          <Card T={T} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Bus Occupancy — Outbound vs Return</div>
              <div style={{ fontSize: 12, color: T.muted }}>{busTrips.length} trips</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.tableHead }}>
                    <th colSpan={2} style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: T.text, borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>TRIP</th>
                    <th colSpan={4} style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#3b82f6", borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`, background: "#eff6ff" }}>OUTBOUND</th>
                    <th colSpan={4} style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#16a34a", borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`, background: "#f0fdf4" }}>RETURN</th>
                    <th colSpan={4} style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: T.warning, borderBottom: `1px solid ${T.border}`, background: T.warningBg }}>DIFFERENCE</th>
                  </tr>
                  <tr style={{ background: T.tableHead }}>
                    {["Start","End","RC","FC","PRE","Total","RC","FC","PRE","Total","RC","FC","PRE","Total"].map((h,i) => (
                      <th key={i} style={{ padding: "6px 10px", textAlign: i < 2 ? "left" : "right",
                        fontWeight: 600, fontSize: 10, color: T.muted, borderBottom: `2px solid ${T.border}`,
                        borderRight: [1,5,9].includes(i) ? `1px solid ${T.border}` : "none",
                        textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trips.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? T.tableRow : T.tableRowAlt,
                      borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "7px 10px", fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>{row.StartDate}</td>
                      <td style={{ padding: "7px 10px", color: T.muted, whiteSpace: "nowrap", borderRight: `1px solid ${T.border}` }}>{row.EndDate}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: T.text }}>{fmtNum(row.ORC)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: T.text }}>{fmtNum(row.OFC)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: T.text }}>{fmtNum(row.OPRE)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: T.text, borderRight: `1px solid ${T.border}` }}>{fmtNum(row.OTotal)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: T.text }}>{fmtNum(row.RRC)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: T.text }}>{fmtNum(row.RFC)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: T.text }}>{fmtNum(row.RPRE)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: T.text, borderRight: `1px solid ${T.border}` }}>{fmtNum(row.RTotal)}</td>
                      {[row.RC_Diff, row.FC_Diff, row.PRE_Diff, row.Total_Difference].map((v, vi) => (
                        <td key={vi} style={{ padding: "7px 10px", textAlign: "right", fontWeight: vi === 3 ? 700 : 400,
                          color: diffColor(v), background: diffBg(v) + "44" }}>{Number(v) >= 0 ? "+" : ""}{fmtNum(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tripPages > 1 && (
              <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.muted }}>RC=Royal Class &nbsp;|&nbsp; FC=First Class &nbsp;|&nbsp; PRE=Premium</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn onClick={() => setTripPage(p => Math.max(0,p-1))} disabled={tripPage===0} variant="secondary" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Prev</Btn>
                  <span style={{ fontSize: 12, color: T.muted, alignSelf: "center" }}>{tripPage+1} / {tripPages}</span>
                  <Btn onClick={() => setTripPage(p => Math.min(tripPages-1,p+1))} disabled={tripPage>=tripPages-1} variant="secondary" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Next</Btn>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {mode === "snowtravel" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card T={T} style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>Bookings / PAX by Bus Class</div>
              <BusClassChart data={stClass} metric={classMetric} T={T} />
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {["bookings","pax"].map(m => (
                  <button key={m} onClick={() => setClassMetric(m)}
                    style={{ background: classMetric === m ? T.accent : T.bg, color: classMetric === m ? "#fff" : T.muted,
                      border: `1px solid ${classMetric === m ? T.accent : T.border}`, borderRadius: 6,
                      padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, textTransform: "capitalize" }}>{m}</button>
                ))}
              </div>
            </Card>
            <Card T={T} style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>Revenue by Bus Class</div>
              <BusClassChart data={stClass} metric="revenue" T={T} />
            </Card>
          </div>

          <Card T={T} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Snowtravel Bus Occupancy</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.tableHead }}>
                    {["Departure","Return","Dream Class","First Class","Sleep/Royal","Total PAX"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: h === "Departure" || h === "Return" ? "left" : "right",
                        fontWeight: 600, fontSize: 11, color: T.muted, textTransform: "uppercase",
                        letterSpacing: "0.05em", borderBottom: `2px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stData.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? T.tableRow : T.tableRowAlt, borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "7px 12px", fontWeight: 600, color: T.text }}>{row.departure_date}</td>
                      <td style={{ padding: "7px 12px", color: T.muted }}>{row.return_date}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.text }}>{fmtNum(row.dream_class)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.text }}>{fmtNum(row.first_class)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: T.text }}>{fmtNum(row.sleep_royal_class)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: T.text }}>{fmtNum(row.total_pax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── DATA TABLE TAB ────────────────────────────────────────────────────────────
function DataTableTab({ T, user, applied, onUnauth }) {
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("departure_date");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [expDatasets, setExpDatasets] = useState([]);
  const [expStatus, setExpStatus] = useState("");
  const [expDepFrom, setExpDepFrom] = useState("");
  const [expDepTo, setExpDepTo] = useState("");
  const [expBkFrom, setExpBkFrom] = useState("");
  const [expBkTo, setExpBkTo] = useState("");
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    setLoading(true);
    const params = buildParams(applied);
    const url = new URL(BASE + "/api/dashboard/export");
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
      else if (v !== "" && v != null) url.searchParams.set(k, v);
    });
    url.searchParams.set("token", localStorage.getItem("ttp_token"));
    fetch(url.toString())
      .then(r => {
        if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
        return r.text();
      })
      .then(csv => {
        const lines = csv.trim().split('\n');
        if (lines.length < 2) {
          setAllRows([]);
          setRows([]);
          setTotal(0);
          return;
        }
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''));
          const obj = {};
          headers.forEach((h, i) => obj[headers[i]] = values[i] || '');
          return obj;
        });
        setAllRows(data);
        setRows(data.slice(0, PAGE_SIZE));
        setTotal(data.length);
        setPage(0);
      })
      .catch(e => {
        if (e.status === 401) onUnauth();
        setAllRows([]);
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [applied]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setRows(allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
  }, [page, allRows]);

  const cols = [
    { key: "Booking ID", label: "Booking ID", width: 160 },
    { key: "Dataset", label: "Dataset", width: 100 },
    { key: "Status", label: "Status", width: 90 },
    { key: "Booking Date", label: "Booking Date", width: 110 },
    { key: "Departure Date", label: "Departure", width: 100 },
    { key: "Return Date", label: "Return", width: 100 },
    { key: "PAX", label: "PAX", width: 60, align: "right" },
    { key: "Revenue", label: "Revenue", width: 100, align: "right" },
    { key: "Bus Type", label: "Bus Type", width: 110 },
    { key: "Destination", label: "Destination", width: 130 },
  ];

  const downloadCSV = () => {
    const p = new URLSearchParams();
    p.set("token", localStorage.getItem("ttp_token"));
    if (expDatasets.length) expDatasets.forEach(d => p.append("dataset", d));
    if (expStatus) p.set("status", expStatus);
    if (expDepFrom) p.set("departureDateFrom", expDepFrom);
    if (expDepTo) p.set("departureDateTo", expDepTo);
    if (expBkFrom) p.set("bookingDateFrom", expBkFrom);
    if (expBkTo) p.set("bookingDateTo", expBkTo);
    window.open(`${BASE}/api/dashboard/export?${p.toString()}`, "_blank");
    setExportModal(false);
  };

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search booking ID, destination, dataset..."
            style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8,
              color: T.text, padding: "8px 12px 8px 32px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <span style={{ fontSize: 13, color: T.muted }}>{total.toLocaleString()} records</span>
        {isAdmin && <Btn onClick={() => setExportModal(true)} T={T} variant="ghost">Export CSV</Btn>}
      </div>

      {/* Table */}
      <Card T={T} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1200 }}>
            <thead>
              <tr style={{ background: T.tableHead }}>
                {cols.map(c => (
                  <th key={c.key} onClick={() => { setSortCol(c.key); setSortDir(d => d === "asc" ? "desc" : "asc"); setPage(0); }}
                    style={{ padding: "9px 12px", textAlign: c.align || "left", fontWeight: 600, fontSize: 11,
                      color: sortCol === c.key ? T.accent : T.muted, textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: `2px solid ${T.border}`, cursor: "pointer", whiteSpace: "nowrap",
                      width: c.width, userSelect: "none" }}>
                    {c.label} {sortCol === c.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length} style={{ padding: 24, textAlign: "center", color: T.muted }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={cols.length} style={{ padding: 24, textAlign: "center", color: T.muted }}>No data found</td></tr>
              ) : rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? T.tableRow : T.tableRowAlt,
                  borderBottom: `1px solid ${T.border}`, transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.tableHover}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? T.tableRow : T.tableRowAlt}>
                  {cols.map(c => (
                    <td key={c.key} style={{ padding: "7px 12px", textAlign: c.align || "left", color: T.text, whiteSpace: "nowrap", maxWidth: c.width, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.key === "status" ? <StatusBadge status={row[c.key]} T={T} /> :
                       c.key === "revenue" ? fmtEur(row[c.key]) :
                       c.key === "period" ? `${MONTHS[(row.month||1)-1]}-${row.year}` :
                       c.key === "dataset" ? <span style={{ background: T.accentLight, color: T.accent, padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{row[c.key]}</span> :
                       row[c.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.muted }}>Page {page+1} of {pages}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <Btn onClick={() => setPage(0)} disabled={page===0} variant="secondary" T={T} style={{ padding: "4px 8px", fontSize: 12 }}>«</Btn>
              <Btn onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0} variant="secondary" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Prev</Btn>
              <Btn onClick={() => setPage(p => Math.min(pages-1,p+1))} disabled={page>=pages-1} variant="secondary" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Next</Btn>
              <Btn onClick={() => setPage(pages-1)} disabled={page>=pages-1} variant="secondary" T={T} style={{ padding: "4px 8px", fontSize: 12 }}>»</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Export Modal */}
      {exportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, width: 460, boxShadow: T.shadowMd }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Export Data</div>
              <button onClick={() => setExportModal(false)} style={{ background: "none", border: "none", fontSize: 18, color: T.muted, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Dataset</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d => (
                    <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: T.text }}>
                      <input type="checkbox" checked={expDatasets.includes(d)} onChange={e => setExpDatasets(prev => e.target.checked ? [...prev,d] : prev.filter(x=>x!==d))} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Status</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["","All"],["ok","OK only"],["cancelled","Cancelled only"]].map(([v,l]) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13, color: T.text }}>
                      <input type="radio" checked={expStatus===v} onChange={() => setExpStatus(v)} /> {l}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Departure From</div>
                  <input type="date" value={expDepFrom} onChange={e=>setExpDepFrom(e.target.value)}
                    style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "7px 8px", fontSize: 12, colorScheme: T.id==="dark"?"dark":"light" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Departure To</div>
                  <input type="date" value={expDepTo} onChange={e=>setExpDepTo(e.target.value)}
                    style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "7px 8px", fontSize: 12, colorScheme: T.id==="dark"?"dark":"light" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Booking From</div>
                  <input type="date" value={expBkFrom} onChange={e=>setExpBkFrom(e.target.value)}
                    style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "7px 8px", fontSize: 12, colorScheme: T.id==="dark"?"dark":"light" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Booking To</div>
                  <input type="date" value={expBkTo} onChange={e=>setExpBkTo(e.target.value)}
                    style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "7px 8px", fontSize: 12, colorScheme: T.id==="dark"?"dark":"light" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8 }}>
                <Btn onClick={() => setExportModal(false)} variant="secondary" T={T}>Cancel</Btn>
                <Btn onClick={downloadCSV} T={T}>Download CSV</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI ASSISTANT TAB ──────────────────────────────────────────────────────────
function AITab({ T, onUnauth }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "Hello! I'm your TTP Analytics AI, powered by OpenAI. I have access to your live booking data from Azure SQL. Ask me anything about your data!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef();

  const suggestions = [
    "What is the total revenue for Solmar in 2025?",
    "Compare bookings between 2024 and 2025",
    "Which departure city has the most PAX?",
    "What is the bus occupancy for Royal Class?",
    "Show revenue breakdown by transport type",
    "Which month had the highest bookings in 2026?",
    "What is the difference between Snowtravel and Solmar revenue?",
    "How many PAX travelled in February 2025?",
  ];

  const send = async (q) => {
    if (!q.trim() || loading) return;
    setMsgs(m => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const token = localStorage.getItem("ttp_token");
      const r = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      if (r.status === 401) { onUnauth(); return; }
      const d = await r.json();
      setMsgs(m => [...m, { role: "assistant", text: d.reply || "Sorry, I could not get a response." }]);
    } catch {
      setMsgs(m => [...m, { role: "assistant", text: "Connection error. Please check that the backend is running." }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, height: "calc(100vh - 160px)" }}>
      {/* Chat */}
      <Card T={T} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>TTP AI Assistant</div>
            <div style={{ fontSize: 11, color: T.success }}>● Powered by OpenAI · Live data</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? T.accent : T.tableRowAlt, color: m.role === "user" ? "#fff" : T.text,
                fontSize: 13, lineHeight: 1.6, boxShadow: T.shadow, border: m.role === "assistant" ? `1px solid ${T.border}` : "none" }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "10px 16px", borderRadius: "14px 14px 14px 4px", background: T.tableRowAlt, border: `1px solid ${T.border}`, fontSize: 13, color: T.muted }}>
                Analysing data...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="Ask about your data..."
            style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8,
              color: T.text, padding: "9px 12px", fontSize: 13, outline: "none" }} />
          <Btn onClick={() => send(input)} disabled={!input.trim() || loading} T={T} style={{ padding: "9px 18px" }}>Send</Btn>
        </div>
      </Card>

      {/* Sidebar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card T={T} style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Suggested Questions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((q, i) => (
              <button key={i} onClick={() => send(q)}
                style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSub,
                  padding: "8px 10px", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4,
                  transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.accentLight; e.currentTarget.style.color = T.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.color = T.textSub; }}>
                {q}
              </button>
            ))}
          </div>
        </Card>
        <Card T={T} style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>Data Sources</div>
          {["Snowtravel","Solmar","Interbus","Solmar DE"].map(ds => (
            <div key={ds} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: T.textSub }}>
              <span style={{ color: T.success }}>●</span>{ds}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────────
function SettingsTab({ T, setThemeName, themeName, onUnauth }) {
  const [users, setUsers] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [newUser, setNewUser] = useState({ name:"", username:"", email:"", password:"", role:"viewer" });
  const [showAdd, setShowAdd] = useState(false);
  const [apiKeys, setApiKeys] = useState({ openai: "", anthropic: "" });
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("ttp_token");
    fetch(`${BASE}/api/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); })
      .catch(() => {});
  }, []);

  const saveUser = async (u) => {
    const token = localStorage.getItem("ttp_token");
    const url = u.id ? `${BASE}/api/auth/users/${u.id}` : `${BASE}/api/auth/users`;
    const method = u.id ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(u) });
    const d = await r.json();
    if (d.users) setUsers(d.users);
    else if (Array.isArray(d)) setUsers(d);
    setEditUser(null); setShowAdd(false);
    setNewUser({ name:"", username:"", email:"", password:"", role:"viewer" });
    setSaved("User saved!"); setTimeout(() => setSaved(""), 2000);
  };

  const deleteUser = async (id) => {
    if (!confirm("Delete this user?")) return;
    const token = localStorage.getItem("ttp_token");
    const r = await fetch(`${BASE}/api/auth/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (Array.isArray(d)) setUsers(d);
    else if (d.users) setUsers(d.users);
    setSaved("User deleted!"); setTimeout(() => setSaved(""), 2000);
  };

  const fieldStyle = { background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: "8px 10px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      {saved && <div style={{ background: T.successBg, border: `1px solid ${T.success}`, borderRadius: 8, padding: "10px 16px", color: T.success, fontSize: 13, fontWeight: 600 }}>{saved}</div>}

      {/* Theme */}
      <Card T={T} style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Theme</div>
        <div style={{ display: "flex", gap: 12 }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <div key={key} onClick={() => setThemeName(key)}
              style={{ flex: 1, border: `2px solid ${themeName === key ? T.accent : T.border}`, borderRadius: 10, padding: 14, cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: "100%", height: 60, borderRadius: 6, background: theme.bg, border: `1px solid ${theme.border}`, marginBottom: 8, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 40, background: theme.sidebar, borderRight: `1px solid ${theme.border}` }} />
                <div style={{ position: "absolute", top: 8, left: 48, right: 8, height: 10, background: theme.card, borderRadius: 3 }} />
                <div style={{ position: "absolute", top: 24, left: 48, right: 8, height: 28, background: theme.card, borderRadius: 3 }} />
                <div style={{ position: "absolute", top: 24, left: 48, width: 14, height: 28, background: theme.accent, borderRadius: "3px 0 0 3px" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{theme.name}</div>
              {themeName === key && <div style={{ fontSize: 11, color: T.accent, marginTop: 2 }}>✓ Active</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* User Management */}
      <Card T={T} style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>User Management</div>
          <Btn onClick={() => setShowAdd(true)} T={T} style={{ padding: "7px 14px" }}>+ Add User</Btn>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.tableHead }}>
              {["Name","Username","Email","Role","Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 11,
                  color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id || i} style={{ background: i%2===0?T.tableRow:T.tableRowAlt, borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "10px 16px", fontWeight: 600, color: T.text }}>{u.name}</td>
                <td style={{ padding: "10px 16px", color: T.textSub }}>{u.username}</td>
                <td style={{ padding: "10px 16px", color: T.muted }}>{u.email}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{ background: u.role==="admin"?T.accentLight:T.badge, color: u.role==="admin"?T.accent:T.muted, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{u.role}</span>
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn onClick={() => setEditUser({ ...u })} variant="ghost" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Edit</Btn>
                    <Btn onClick={() => deleteUser(u.id)} variant="danger" T={T} style={{ padding: "4px 10px", fontSize: 12 }}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Edit/Add User Modal */}
      {(editUser || showAdd) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, width: 440, boxShadow: T.shadowMd }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{editUser ? "Edit User" : "Add New User"}</div>
              <button onClick={() => { setEditUser(null); setShowAdd(false); }} style={{ background: "none", border: "none", fontSize: 20, color: T.muted, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["Name","name","text"],["Username","username","text"],["Email","email","email"],["Password","password","password"]].map(([label,key,type]) => (
                <div key={key}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                  <input type={type} value={editUser ? (editUser[key]||"") : (newUser[key]||"")}
                    onChange={e => editUser ? setEditUser(u => ({...u,[key]:e.target.value})) : setNewUser(u => ({...u,[key]:e.target.value}))}
                    style={fieldStyle} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>Role</div>
                <select value={editUser ? editUser.role : newUser.role}
                  onChange={e => editUser ? setEditUser(u => ({...u,role:e.target.value})) : setNewUser(u => ({...u,role:e.target.value}))}
                  style={fieldStyle}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8 }}>
                <Btn onClick={() => { setEditUser(null); setShowAdd(false); }} variant="secondary" T={T}>Cancel</Btn>
                <Btn onClick={() => saveUser(editUser || newUser)} T={T}>Save</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Keys */}
      <Card T={T} style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>API Keys</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["OpenAI API Key","openai","sk-proj-..."],["Anthropic API Key","anthropic","sk-ant-..."]].map(([label,key,ph]) => (
            <div key={key}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={apiKeys[key]} onChange={e => setApiKeys(k => ({...k,[key]:e.target.value}))}
                  placeholder={ph} style={{ ...fieldStyle, flex: 1 }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: T.muted }}>Note: API keys are configured in the backend .env file. Contact your system administrator to update them.</div>
        </div>
      </Card>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ttp_token"));
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("ttp_user")); } catch { return null; } });
  const [tab, setTab] = useState("overview");
  const [themeName, setThemeName] = useState(() => localStorage.getItem("ttp_theme") || "gray");
  const [filters, setFilters] = useState({ datasets:[], statuses:[], transportTypes:[], departureDateFrom:"", departureDateTo:"", bookingDateFrom:"", bookingDateTo:"" });
  const [applied, setApplied] = useState({});
  const [slicers, setSlicers] = useState({});
  const [lastRefresh, setLastRefresh] = useState(dubaiTime());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const T = THEMES[themeName] || THEMES.gray;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    localStorage.setItem("ttp_theme", themeName);
  }, [themeName]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/dashboard/slicers").then(d => { if (d && !d.error) setSlicers(d); }).catch(() => {});
    const interval = setInterval(() => {
      const now = new Date();
      const dubai = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
      if (dubai.getHours() === 0 && dubai.getMinutes() === 0) {
        setApplied(a => ({ ...a }));
        setLastRefresh(dubaiTime());
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogin = (tok, u) => {
    localStorage.setItem("ttp_token", tok);
    localStorage.setItem("ttp_user", JSON.stringify(u));
    setToken(tok); setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("ttp_token");
    localStorage.removeItem("ttp_user");
    setToken(null); setUser(null);
  };

  const handleUnauth = () => { handleLogout(); };

  const applyFilters = () => { setApplied({ ...filters }); setLastRefresh(dubaiTime()); };
  const resetFilters = () => {
    const empty = { datasets:[], statuses:[], transportTypes:[], departureDateFrom:"", departureDateTo:"", bookingDateFrom:"", bookingDateTo:"" };
    setFilters(empty); setApplied({});
  };

  if (!token) return <Login onLogin={handleLogin} themeName={themeName} setThemeName={setThemeName} />;

  const navItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "bus", label: "Bus Occupancy", icon: "🚌" },
    { id: "data", label: "Data Table", icon: "📋" },
    { id: "ai", label: "AI Assistant", icon: "🤖" },
    ...(isAdmin ? [{ id: "settings", label: "Settings", icon: "⚙️" }] : []),
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 220 : 60, background: T.sidebar, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s", overflow: "hidden",
        boxShadow: T.shadowMd, zIndex: 10 }}>

        {/* Logo */}
        <div style={{ padding: sidebarOpen ? "18px 20px" : "18px 14px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 10, minHeight: 64 }}>
          <img src="/assets/logo.png" alt="TTP" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
          <div style={{ display: "none", width: 32, height: 32, background: T.accent, borderRadius: 6,
            alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>TTP</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>TTP</div>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Analytics</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: sidebarOpen ? "10px 14px" : "10px",
                borderRadius: 8, border: "none", marginBottom: 2, cursor: "pointer", textAlign: "left", justifyContent: sidebarOpen ? "flex-start" : "center",
                background: tab === item.id ? T.accentLight : "transparent",
                color: tab === item.id ? T.accent : T.muted, fontWeight: tab === item.id ? 700 : 500, fontSize: 13,
                transition: "all 0.15s" }}
              title={!sidebarOpen ? item.label : undefined}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 8px", borderTop: `1px solid ${T.border}` }}>
          {sidebarOpen && (
            <div style={{ padding: "8px 14px", marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{user?.role}</div>
            </div>
          )}
          <button onClick={handleLogout} title="Logout"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: sidebarOpen ? "10px 14px" : "10px",
              borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: T.muted, fontSize: 13,
              justifyContent: sidebarOpen ? "flex-start" : "center", fontWeight: 500 }}>
            <span style={{ fontSize: 16 }}>🚪</span>
            {sidebarOpen && "Logout"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "0 20px",
          display: "flex", alignItems: "center", height: 56, gap: 12, flexShrink: 0, boxShadow: T.shadow }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 18, padding: 4 }}>☰</button>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
            {navItems.find(n => n.id === tab)?.label}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: T.muted }}>Last sync: {lastRefresh} Dubai</div>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.accent, display: "flex",
              alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </div>

        {/* Filters bar (not on settings/AI) */}
        {["overview","bus","data"].includes(tab) && (
          <FiltersBar filters={filters} setFilters={setFilters} onApply={applyFilters} onReset={resetFilters} slicers={slicers} T={T} />
        )}

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "overview"  && <OverviewTab T={T} applied={applied} onUnauth={handleUnauth} />}
          {tab === "bus"       && <BusOccupancyTab T={T} onUnauth={handleUnauth} />}
          {tab === "data"      && <DataTableTab T={T} user={user} applied={applied} onUnauth={handleUnauth} />}
          {tab === "ai"        && <AITab T={T} onUnauth={handleUnauth} />}
          {tab === "settings" && isAdmin && <SettingsTab T={T} setThemeName={setThemeName} themeName={themeName} onUnauth={handleUnauth} />}
        </div>
      </div>
    </div>
  );
}
