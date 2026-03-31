import { useState, useEffect, useCallback, useRef } from "react";
import { Eye, EyeOff, ShieldCheck, LayoutDashboard, Hotel, Bus, Settings, Bot } from "lucide-react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const RAW_BASE = (import.meta.env.VITE_API_URL || "https://ttp-dashboard-api-dpczbed3bvhchxe9.belgiumcentral-01.azurewebsites.net").trim();
const BASE = RAW_BASE.replace(/\/+$/, "");
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        "#080e1a",
  sidebar:   "#0d1526",
  card:      "#111d33",
  cardHover: "#162035",
  border:    "#1e3050",
  border2:   "#243760",
  accent:    "#2563eb",
  accentHi:  "#3b82f6",
  accentSoft:"#1e3a6e",
  text:      "#e8f0fe",
  textMid:   "#8ba3cc",
  textDim:   "#4d6a9a",
  success:   "#10b981",
  successSoft:"#0a3d2b",
  danger:    "#ef4444",
  dangerSoft:"#3d1515",
  warn:      "#f59e0b",
  warnSoft:  "#3d2a0a",
  purple:    "#8b5cf6",
  purpleSoft:"#2d1f5e",
  teal:      "#14b8a6",
  tealSoft:  "#0a3330",
};

// Distinct line colors per year (at least 2022 and 2026 must be different)
const YEAR_COLORS = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
];

// ─── TOKEN MANAGEMENT ─────────────────────────────────────────────────────────
function saveToken(token, user) {
  try { localStorage.setItem("ttp_token", token); } catch(_) {}
  try { sessionStorage.setItem("ttp_token", token); } catch(_) {}
  try { localStorage.setItem("ttp_user", JSON.stringify(user)); } catch(_) {}
}
function loadToken() {
  try { const t = localStorage.getItem("ttp_token"); if (t) return t; } catch(_) {}
  try { return sessionStorage.getItem("ttp_token"); } catch(_) {}
  return null;
}
function loadUser() {
  try { const u = localStorage.getItem("ttp_user"); return u ? JSON.parse(u) : null; } catch(_) { return null; }
}
function clearToken() {
  try { localStorage.removeItem("ttp_token"); localStorage.removeItem("ttp_user"); } catch(_) {}
  try { sessionStorage.removeItem("ttp_token"); } catch(_) {}
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    // base64url -> base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

function isTokenValid(token) {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return false;
    return Number(payload.exp) > Date.now() / 1000;
  } catch (_) { return false; }
}

// ─── API HELPER ───────────────────────────────────────────────────────────────
let logoutFn = () => {};

async function apiFetch(path, params = {}, token) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([,v]) => v !== "" && v !== null && v !== undefined))
  ).toString();
  const url = `${BASE}${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function safeApiFetch(path, params = {}, token) {
  try {
    return await apiFetch(path, params, token);
  } catch (e) {
    if (e?.status === 401) {
      try { logoutFn(); } catch (_) {}
    }
    throw e;
  }
}

// ─── MINI CHART (SVG bar) ─────────────────────────────────────────────────────
function SparkBar({ data, color = C.accent, height = 40 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.v || 0), 1);
  const w = 120, bw = Math.max(2, (w / data.length) - 1);
  return (
    <svg width={w} height={height} style={{ display: "block" }}>
      {data.map((d, i) => {
        const bh = Math.max(2, ((d.v || 0) / max) * height);
        return <rect key={i} x={i * (bw + 1)} y={height - bh} width={bw} height={bh}
          fill={color} opacity={0.7} rx={1} />;
      })}
    </svg>
  );
}

// ─── BAR CHART (chronological year-month slots) ───────────────────────────
function BarChart({ data, title, metric = "revenue" }) {
  if (!data?.length) return null;

  // Sort by chronological year-month so cross-year ranges render correctly.
  const sortedData = [...data].sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));

  // Build ordered unique {yr, mo} slots for the X-axis.
  const slotKeys = [];
  const seen = new Set();
  sortedData.forEach(d => {
    const k = d.year * 100 + d.month;
    if (seen.has(k)) return;
    seen.add(k);
    slotKeys.push(k);
  });
  const slots = slotKeys.map(k => ({ yr: Math.floor(k / 100), mo: k % 100 }));

  const yearsInSlots = new Set(slots.map(s => s.yr));
  const multiYear = yearsInSlots.size > 1;
  const byYearMonth = new Map(sortedData.map(d => [`${d.year}-${d.month}`, d]));

  const values = slots.map(s => {
    const row = byYearMonth.get(`${s.yr}-${s.mo}`);
    const v = row ? (row[metric] ?? 0) : 0;
    return typeof v === "number" ? v : 0;
  });
  const maxVal = Math.max(...values, 1);

  const W = 700, H = 220, PAD = { t: 20, r: 20, b: 45, l: 70 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  const xStep = slots.length ? cW / slots.length : cW;
  const bw = Math.max(6, xStep * 0.6);
  const toY = v => PAD.t + cH - (v / maxVal) * cH;
  const toX = i => PAD.l + i * xStep + (xStep - bw) / 2;

  const fmtVal = v => {
    if (metric === "revenue") return v >= 1e6 ? `€${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `€${(v / 1e3).toFixed(0)}K` : `€${v}`;
    return v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v);
  };

  return (
    <div>
      {title && <div style={{ fontSize: 13, color: C.textMid, marginBottom: 8, fontWeight: 600 }}>{title}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Grid */}
        {[0, 1, 2, 3, 4].map(i => {
          const v = (maxVal / 4) * i;
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={C.border2} strokeWidth={0.5} />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fill={C.textDim} fontSize={10}>
                {fmtVal(v)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {slots.map((s, i) => {
          const v = values[i] || 0;
          const bh = Math.max(2, (v / maxVal) * cH);
          return (
            <g key={`${s.yr}-${s.mo}`}>
              <rect x={toX(i)} y={PAD.t + cH - bh} width={bw} height={bh} fill={C.accent} opacity={0.8} rx={2} />
              <text
                x={toX(i) + bw / 2}
                y={H - 14}
                textAnchor="middle"
                fill={C.textDim}
                fontSize={10}
              >
                {MONTHS_SHORT[s.mo - 1]}
                {multiYear ? "'" + String(s.yr).slice(-2) : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── LINE CHART (multi-year) ──────────────────────────────────────────────────
function LineChart({ data, dateFrom, metric = "revenue", title }) {
  // data = [{year, month, revenue, bookings, pax}]
  // Sort by chronological year-month before building year->month lookup.
  const sortedData = [...data].sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));

  // Fiscal calendar ordering (12 labels) anchored to dateFrom, or derived from first row.
  const startMonth = dateFrom ? (parseInt(dateFrom.split("-")[1]) || 1) : (sortedData[0]?.month || 1);
  const years = [...new Set(sortedData.map(d => d.year))].sort((a, b) => a - b);

  // Build ordered months: start from startMonth, wrap around.
  const orderedMonths = [];
  for (let i = 0; i < 12; i++) {
    orderedMonths.push(((startMonth - 1 + i) % 12) + 1);
  }

  const byYearMonth = new Map(sortedData.map(d => [`${d.year}-${d.month}`, d]));

  // Build series per year.
  const series = years.map((yr, i) => ({
    year: yr,
    color: YEAR_COLORS[i % YEAR_COLORS.length],
    points: orderedMonths.map(mo => {
      const row = byYearMonth.get(`${yr}-${mo}`);
      return row ? (row[metric] ?? null) : null;
    }),
  }));

  const allVals = series.flatMap(s => s.points.filter(p => p !== null));
  const maxVal = Math.max(...allVals, 1);
  const W = 700, H = 220, PAD = { t: 20, r: 20, b: 40, l: 70 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const xStep = cW / 11;

  const toY = v => PAD.t + cH - (v / maxVal) * cH;
  const toX = i => PAD.l + i * xStep;

  const fmtVal = v => {
    if (metric === "revenue") return v >= 1e6 ? `€${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `€${(v/1e3).toFixed(0)}K` : `€${v}`;
    return v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : String(v);
  };

  const yTicks = 5;
  return (
    <div>
      {title && <div style={{ fontSize: 13, color: C.textMid, marginBottom: 8, fontWeight: 600 }}>{title}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {Array.from({ length: yTicks }).map((_, i) => {
          const v = (maxVal / (yTicks - 1)) * i;
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={C.border2} strokeWidth={0.5} />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fill={C.textDim} fontSize={10}>
                {fmtVal(v)}
              </text>
            </g>
          );
        })}
        {/* X axis labels */}
        {orderedMonths.map((mo, i) => (
          <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fill={C.textDim} fontSize={10}>
            {MONTHS_SHORT[mo - 1]}
          </text>
        ))}
        {/* Lines */}
        {series.map(s => {
          const pts = s.points
            .map((v, i) => v !== null ? [toX(i), toY(v)] : null)
            .filter(Boolean);
          if (!pts.length) return null;
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
          return (
            <g key={s.year}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        {series.map(s => (
          <div key={s.year} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 3, background: s.color, borderRadius: 2 }} />
            <span style={{ fontSize: 12, color: C.textMid }}>{s.year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, current, previous, diff, pct, format, prevLabel, color = C.accent }) {
  const up = diff >= 0;
  const fmt = v => {
    if (v == null) return "—";
    if (format === "currency") return `€${(v / 1e6).toFixed(2)}M`;
    if (format === "currency_k") return v >= 1e6 ? `€${(v/1e6).toFixed(2)}M` : `€${Math.round(v).toLocaleString("nl-BE")}`;
    if (format === "number") return Math.round(v).toLocaleString("nl-BE");
    return v;
  };
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "20px 24px", border: `1px solid ${C.border}`, flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", marginBottom: 6 }}>{fmt(current)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: C.textMid }}>vs {prevLabel || "prev"}: {fmt(previous)}</span>
      </div>
      {pct != null && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: up ? C.success : C.danger }}>
            {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
          </span>
          <span style={{ fontSize: 12, color: C.textDim }}>({fmt(diff)})</span>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN COMPONENT ──────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter credentials"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("Invalid username or password");
        } else {
          setError(data.error || "Login failed");
        }
        return;
      }
      saveToken(data.token, { ...data.user, token: data.token });
      onLogin({ ...data.user, token: data.token });
    } catch (e) {
      setError("Cannot connect to server. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "48px 40px", width: 380, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: `linear-gradient(135deg, ${C.accent}, ${C.accentHi})`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>
            <ShieldCheck size={26} color="#e5f2ff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>TTP Services</div>
          <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>Analytics Dashboard</div>
        </div>

        {error && (
          <div style={{ background: C.dangerSoft, border: `1px solid ${C.danger}`, borderRadius: 8, padding: "10px 14px", color: C.danger, fontSize: 13, marginBottom: 20 }}>{error}</div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>USERNAME</label>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="ttp_admin"
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "11px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 24, position: "relative" }}>
          <label style={{ display: "block", fontSize: 12, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>PASSWORD</label>
          <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
            type={showPw ? "text" : "password"} placeholder="••••••••"
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "11px 40px 11px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            style={{ position: "absolute", right: 10, top: 34, cursor: "pointer", color: C.textDim, fontSize: 16, background: "transparent", border: "none", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", background: loading ? C.accentSoft : `linear-gradient(135deg, ${C.accent}, ${C.accentHi})`, color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", transition: "opacity 0.2s" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: C.textDim }}>Secured · TTP Services Belgium</div>
      </div>
    </div>
  );
}

// ─── HOTEL STARS ──────────────────────────────────────────────────────────────
function RatingBar({ value, max = 100, color = C.accent }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const clr = pct >= 80 ? C.success : pct >= 60 ? C.warn : C.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: clr, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color: C.textMid, minWidth: 28 }}>{value ?? "—"}</span>
    </div>
  );
}

// ─── PENDEL TABLE ─────────────────────────────────────────────────────────────
function PendelTable({ data }) {
  if (!data?.length) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>No pendel data for selected filters</div>;
  const cols = [
    { key: "StartDate", label: "Start Date", w: 100 },
    { key: "EndDate", label: "Return Date", w: 100 },
    { key: "Outbound_Total", label: "Out Total", w: 80 },
    { key: "ORC", label: "Out RC", w: 70 },
    { key: "OFC", label: "Out FC", w: 70 },
    { key: "OPRE", label: "Out PRE", w: 70 },
    { key: "Inbound_Total", label: "In Total", w: 80 },
    { key: "RRC", label: "In RC", w: 70 },
    { key: "RFC", label: "In FC", w: 70 },
    { key: "RPRE", label: "In PRE", w: 70 },
    { key: "Diff_Royal", label: "Δ RC", w: 65 },
    { key: "Diff_First", label: "Δ FC", w: 65 },
    { key: "Diff_Premium", label: "Δ PRE", w: 65 },
    { key: "Diff_Total", label: "Δ Total", w: 75 },
  ];
  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 480, borderRadius: 10, border: `1px solid ${C.border}` }}>
      <table style={{ borderCollapse: "collapse", minWidth: "100%", fontSize: 13 }}>
        <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{ padding: "10px 12px", textAlign: c.key.includes("Total") || c.key.includes("RC") || c.key.includes("FC") || c.key.includes("Diff") || c.key.includes("PRE") || c.key.includes("RRC") || c.key.includes("RFC") || c.key.includes("RPRE") || c.key.includes("ORC") || c.key.includes("OFC") || c.key.includes("OPRE") ? "right" : "left", color: C.textMid, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", minWidth: c.w, borderBottom: `1px solid ${C.border}` }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
              {cols.map(c => {
                const isDate = c.key === "StartDate" || c.key === "EndDate";
                const isDiff = c.key.startsWith("Diff_");
                const v = row[c.key];
                return (
                  <td key={c.key} style={{ padding: "9px 12px", textAlign: isDate ? "left" : "right", color: isDiff ? (v < 0 ? C.danger : v > 0 ? C.success : C.textMid) : isDate ? C.text : C.textMid, whiteSpace: "nowrap", fontWeight: isDate ? 500 : 400 }}>
                    {v ?? "—"}
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

// ─── FEEDER TABLE ─────────────────────────────────────────────────────────────
function FeederTable({ data }) {
  if (!data?.length) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>No feeder data for selected filters</div>;

  // Get unique dates sorted
  const dates = [...new Set(data.map(d => d.DepartureDate))].sort((a, b) => {
    const pa = a.split("-"), pb = b.split("-");
    const da = new Date(pa[2], pa[1]-1, pa[0]);
    const db = new Date(pb[2], pb[1]-1, pb[0]);
    return da - db;
  });

  // Build route → stops structure
  const routeMap = {};
  data.forEach(row => {
    const rk = `${row.RouteNo}||${row.RouteLabel||"Route "+row.RouteNo}`;
    if (!routeMap[rk]) routeMap[rk] = { label: row.RouteLabel || `Route ${row.RouteNo}`, no: row.RouteNo, stops: {} };
    const sk = row.StopName;
    if (!routeMap[rk].stops[sk]) routeMap[rk].stops[sk] = {};
    routeMap[rk].stops[sk][row.DepartureDate] = (routeMap[rk].stops[sk][row.DepartureDate] || 0) + (row.TotalPax || 0);
  });

  // Route totals per date
  Object.keys(routeMap).forEach(rk => {
    routeMap[rk].totals = {};
    dates.forEach(dt => {
      const stops = routeMap[rk].stops;
      routeMap[rk].totals[dt] = Object.values(stops).reduce((s, sd) => s + (sd[dt] || 0), 0);
    });
    routeMap[rk].grandTotal = dates.reduce((s, dt) => s + (routeMap[rk].totals[dt] || 0), 0);
  });

  const sortedRoutes = Object.entries(routeMap).sort(([a], [b]) => parseInt(a) - parseInt(b));
  const grandTotals = {};
  dates.forEach(dt => { grandTotals[dt] = sortedRoutes.reduce((s, [, r]) => s + (r.totals[dt] || 0), 0); });
  const grandTotal = dates.reduce((s, dt) => s + (grandTotals[dt] || 0), 0);

  const tdBase = { padding: "8px 12px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", textAlign: "right", fontSize: 13 };
  const thBase = { padding: "10px 12px", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", textAlign: "right" };

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 520, borderRadius: 10, border: `1px solid ${C.border}` }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
          <tr>
            <th style={{ ...thBase, textAlign: "left", position: "sticky", left: 0, background: C.bg, minWidth: 180, zIndex: 2 }}>Pick-up point</th>
            <th style={{ ...thBase, minWidth: 70 }}>Total</th>
            {dates.map(dt => (
              <th key={dt} style={{ ...thBase, minWidth: 80 }}>{dt}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Grand total row */}
          <tr style={{ background: C.accentSoft }}>
            <td style={{ ...tdBase, textAlign: "left", position: "sticky", left: 0, background: C.accentSoft, color: C.text, fontWeight: 700 }}>Totaal vertrek</td>
            <td style={{ ...tdBase, color: C.text, fontWeight: 700 }}>{grandTotal}</td>
            {dates.map(dt => <td key={dt} style={{ ...tdBase, color: C.text, fontWeight: 700 }}>{grandTotals[dt] || 0}</td>)}
          </tr>
          {sortedRoutes.map(([rk, route]) => {
            const stops = Object.entries(route.stops).sort(([a], [b]) => a.localeCompare(b));
            return [
              // Route header row
              <tr key={`r-${rk}`} style={{ background: "rgba(37,99,235,0.08)" }}>
                <td style={{ ...tdBase, textAlign: "left", position: "sticky", left: 0, background: "rgba(37,99,235,0.1)", color: C.accentHi, fontWeight: 700 }}>{route.label}</td>
                <td style={{ ...tdBase, color: C.accentHi, fontWeight: 700 }}>{route.grandTotal}</td>
                {dates.map(dt => <td key={dt} style={{ ...tdBase, color: C.accentHi, fontWeight: 700 }}>{route.totals[dt] || 0}</td>)}
              </tr>,
              // Stop rows
              ...stops.map(([stop, stopDates]) => {
                const stopTotal = dates.reduce((s, dt) => s + (stopDates[dt] || 0), 0);
                return (
                  <tr key={`s-${rk}-${stop}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...tdBase, textAlign: "left", position: "sticky", left: 0, background: C.card, paddingLeft: 28, color: C.textMid }}>{stop}</td>
                    <td style={{ ...tdBase, color: C.textMid }}>{stopTotal}</td>
                    {dates.map(dt => <td key={dt} style={{ ...tdBase, color: stopDates[dt] ? C.text : C.textDim }}>{stopDates[dt] || 0}</td>)}
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── DECK TABLE ───────────────────────────────────────────────────────────────
function DeckTable({ data }) {
  if (!data?.length) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>No deck data for selected filters</div>;
  const groups = [
    { label: "Total",   cols: [{ k: "Total", l: "Total" }, { k: "Total_Lower", l: "Lower" }, { k: "Total_Upper", l: "Upper" }, { k: "Total_NoDeck", l: "No Deck" }] },
    { label: "Royal Class",   cols: [{ k: "Royal_Total", l: "Total" }, { k: "Royal_Lower", l: "Lower" }, { k: "Royal_Upper", l: "Upper" }, { k: "Royal_NoDeck", l: "No Deck" }], color: "#8b5cf6" },
    { label: "First Class",   cols: [{ k: "First_Total", l: "Total" }, { k: "First_Lower", l: "Lower" }, { k: "First_Upper", l: "Upper" }, { k: "First_NoDeck", l: "No Deck" }], color: C.accent },
    { label: "Premium Class", cols: [{ k: "Premium_Total", l: "Total" }, { k: "Premium_Lower", l: "Lower" }, { k: "Premium_Upper", l: "Upper" }, { k: "Premium_NoDeck", l: "No Deck" }], color: C.teal },
  ];
  const allCols = groups.flatMap(g => g.cols);
  const hasDeck = data.some(r => (r.Total_Lower || 0) + (r.Total_Upper || 0) > 0);

  return (
    <div>
      {!hasDeck && (
        <div style={{ background: C.warnSoft, border: `1px solid ${C.warn}`, borderRadius: 8, padding: "10px 16px", color: C.warn, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          ⚠ Lower/Upper deck assignment pending from Samir's pipeline — showing class totals only
        </div>
      )}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 520, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
            {/* Group header row */}
            <tr>
              <th rowSpan={2} style={{ padding: "10px 14px", textAlign: "left", color: C.textMid, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap", minWidth: 110 }}>Departure</th>
              {groups.map(g => (
                <th key={g.label} colSpan={4} style={{ padding: "8px 12px", textAlign: "center", color: g.color || C.textMid, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {g.label}
                </th>
              ))}
            </tr>
            {/* Sub-column header row */}
            <tr>
              {groups.map(g =>
                g.cols.map(c => (
                  <th key={`${g.label}-${c.k}`} style={{ padding: "7px 10px", textAlign: "right", color: C.textDim, fontWeight: 500, fontSize: 11, borderBottom: `1px solid ${C.border}`, borderLeft: c.l === "Total" ? `1px solid ${C.border}` : "none", whiteSpace: "nowrap" }}>
                    {c.l}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                <td style={{ padding: "8px 14px", color: C.text, fontWeight: 500, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{row.dateDeparture}</td>
                {groups.map(g =>
                  g.cols.map(c => (
                    <td key={`${g.label}-${c.k}`} style={{ padding: "8px 10px", textAlign: "right", color: c.l === "Total" ? C.text : (row[c.k] > 0 ? C.textMid : C.textDim), borderLeft: c.l === "Total" ? `1px solid ${C.border}` : "none", fontWeight: c.l === "Total" ? 600 : 400 }}>
                      {row[c.k] ?? 0}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DATA TABLE ───────────────────────────────────────────────────────────────
function DataTable({ token }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ dataset: "", status: "", depFrom: "", depTo: "", bkFrom: "", bkTo: "", search: "" });
  const [applied, setApplied] = useState({ ...filters });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await safeApiFetch("/api/dashboard/bookings-table", { ...applied, page, limit: 50 }, token);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (_) {} finally { setLoading(false); }
  }, [applied, page, token]);

  useEffect(() => { load(); }, [load]);

  const colMap = { BookingID: "Booking ID", Dataset: "Dataset", Status: "Status", Label: "Label", BookingDate: "Booking Date", DepartureDate: "Departure", ReturnDate: "Return", Duration: "Days", PAX: "PAX", Revenue: "Revenue (€)", RevPerPax: "Rev/PAX", TransportType: "Transport", Destination: "Destination", City: "City", Country: "Country" };
  const visibleCols = Object.keys(colMap);

  const exportCSV = () => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(applied).filter(([,v])=>v))).toString();
    window.open(`${BASE}/api/dashboard/export${qs ? "?"+qs : ""}?token=${token}`);
  };
  const exportExcel = () => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(applied).filter(([,v])=>v))).toString();
    window.open(`${BASE}/api/dashboard/export-excel${qs ? "?"+qs : ""}?token=${token}`);
  };

  const inp = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: 20, margin: 0 }}>Booking Data</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportCSV} style={{ background: C.successSoft, color: C.success, border: `1px solid ${C.success}`, borderRadius: 7, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>↓ CSV</button>
          <button onClick={exportExcel} style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid #34d399", borderRadius: 7, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>↓ Excel</button>
          <button onClick={() => window.print()} style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>🖨 Print</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: C.card, borderRadius: 10, padding: 16, marginBottom: 16, border: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>DATASET</div>
          <select value={filters.dataset} onChange={e => setFilters({ ...filters, dataset: e.target.value })} style={inp}>
            <option value="">All Datasets</option>
            <option value="Solmar">Solmar</option>
            <option value="Interbus">Interbus</option>
            <option value="Solmar DE">Solmar DE</option>
            <option value="Snowtravel">Snowtravel</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>STATUS</div>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} style={inp}>
            <option value="">All</option>
            <option value="ok">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>DEP FROM</div>
          <input type="date" value={filters.depFrom} onChange={e => setFilters({ ...filters, depFrom: e.target.value })} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>DEP TO</div>
          <input type="date" value={filters.depTo} onChange={e => setFilters({ ...filters, depTo: e.target.value })} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>SEARCH</div>
          <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Booking ID…" style={{ ...inp, width: 130 }} />
        </div>
        <button onClick={() => { setApplied({ ...filters }); setPage(1); }} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Apply</button>
        <button onClick={() => { const e = { dataset: "", status: "", depFrom: "", depTo: "", bkFrom: "", bkTo: "", search: "" }; setFilters(e); setApplied(e); setPage(1); }} style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Reset</button>
      </div>

      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
        {loading ? "Loading…" : `${total.toLocaleString()} records`}
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 500, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
          <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
            <tr>
              {visibleCols.map(k => (
                <th key={k} style={{ padding: "10px 12px", textAlign: "left", color: C.textMid, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                  {colMap[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                {visibleCols.map(k => (
                  <td key={k} style={{ padding: "8px 12px", whiteSpace: "nowrap", color: k === "Status" ? (row[k] === "ok" ? C.success : row[k] === "cancelled" ? C.danger : C.textMid) : k === "Revenue" ? C.text : C.textMid }}>
                    {k === "Status" ? (row[k] === "ok" ? "✓ Confirmed" : row[k] === "cancelled" ? "✗ Cancelled" : row[k]) : (row[k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr><td colSpan={visibleCols.length} style={{ padding: 40, textAlign: "center", color: C.textDim }}>No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 12, color: C.textDim }}>Page {page} · {Math.ceil(total / 50)} pages</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: page > 1 ? "pointer" : "default", opacity: page > 1 ? 1 : 0.4 }}>← Prev</button>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", cursor: page * 50 < total ? "pointer" : "default", opacity: page * 50 < total ? 1 : 0.4 }}>Next →</button>
        </div>
      </div>
    </div>
  );
}

// ─── HOTEL TAB ────────────────────────────────────────────────────────────────
function HotelTab({ token }) {
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [revPage, setRevPage] = useState(1);
  const [revTotal, setRevTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      safeApiFetch("/api/dashboard/hotel-ratings", {}, token),
      safeApiFetch("/api/dashboard/hotel-stats", {}, token),
    ]).then(([r, s]) => { setRatings(r || []); setStats(s || {}); }).finally(() => setLoading(false));
  }, [token]);

  const loadReviews = useCallback(async (code, page) => {
    try {
      const data = await safeApiFetch("/api/dashboard/hotel-reviews", { code, page, limit: 10 }, token);
      setReviews(data?.rows || []);
      setRevTotal(data?.total || 0);
    } catch (_) {}
  }, [token]);

  useEffect(() => { if (selected) loadReviews(selected.accommodation_code, revPage); }, [selected, revPage, loadReviews]);

  const filtered = ratings.filter(h => !search || h.accommodation_name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>Loading hotel reviews…</div>;

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Hotels", value: stats.total_hotels, color: C.accent },
          { label: "Total Reviews", value: stats.total_reviews?.toLocaleString(), color: C.success },
          { label: "Avg Rating", value: stats.avg_rating ? `${stats.avg_rating}/100` : "—", color: C.warn },
          { label: "High Rated (80+)", value: stats.high_rated, color: C.success },
          { label: "Low Rated (<60)", value: stats.low_rated, color: C.danger },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 130 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value ?? "—"}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 20 }}>
        {/* Hotel list */}
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hotel…"
              style={{ flex: 1, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 7, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }} />
            <span style={{ fontSize: 12, color: C.textDim }}>{filtered.length} hotels</span>
          </div>
          <div style={{ overflowY: "auto", maxHeight: selected ? 580 : 620, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
                <tr>
                  {["Hotel", "Rating", "Reviews", "Rec%", "Location", "Hygiene"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", color: C.textMid, fontWeight: 600, fontSize: 11, textAlign: h === "Hotel" ? "left" : "right", borderBottom: `1px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr key={i} onClick={() => { setSelected(h); setRevPage(1); }}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected?.accommodation_code === h.accommodation_code ? C.accentSoft : i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                    <td style={{ padding: "9px 12px", color: C.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.accommodation_name}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: h.avg_overall >= 80 ? C.success : h.avg_overall >= 60 ? C.warn : C.danger, fontWeight: 700 }}>{h.avg_overall ?? "—"}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.textMid }}>{h.total_reviews ?? 0}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.textMid }}>{h.recommendation_pct != null ? `${h.recommendation_pct}%` : "—"}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.textMid }}>{h.avg_location ?? "—"}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: C.textMid }}>{h.avg_cleanliness ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reviews panel */}
        {selected && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.accommodation_name}</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{revTotal} reviews</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", color: C.textMid, cursor: "pointer", fontSize: 12 }}>✕</button>
            </div>
            {/* Category ratings */}
            <div style={{ background: C.card, borderRadius: 10, padding: 16, marginBottom: 12, border: `1px solid ${C.border}` }}>
              {[["Overall", selected.avg_overall], ["Location", selected.avg_location], ["Hygiene", selected.avg_cleanliness], ["Service", selected.avg_service], ["Facilities", selected.avg_facilities], ["Sleep", selected.avg_sleep]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMid, marginBottom: 3 }}><span>{l}</span></div>
                  <RatingBar value={v} />
                </div>
              ))}
            </div>
            {/* Review list */}
            <div style={{ overflowY: "auto", maxHeight: 380 }}>
              {reviews.map((r, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 8, padding: 14, marginBottom: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.review_title || "Review"}</span>
                    <span style={{ fontSize: 12, color: r.overall_rating >= 80 ? C.success : r.overall_rating >= 60 ? C.warn : C.danger, fontWeight: 700 }}>{r.overall_rating ?? "—"}/100</span>
                  </div>
                  {r.review_text && <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8, lineHeight: 1.5 }}>{r.review_text.length > 200 ? r.review_text.substring(0, 200) + "…" : r.review_text}</div>}
                  <div style={{ fontSize: 11, color: C.textDim }}>
                    {r.reviewer_name} · {r.reviewer_country} · {r.review_date ? new Date(r.review_date).toLocaleDateString("nl-BE") : ""}
                  </div>
                </div>
              ))}
            </div>
            {revTotal > 10 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button disabled={revPage <= 1} onClick={() => setRevPage(p => p - 1)} style={{ flex: 1, background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px", cursor: revPage > 1 ? "pointer" : "default", opacity: revPage > 1 ? 1 : 0.4 }}>← Prev</button>
                <button disabled={revPage * 10 >= revTotal} onClick={() => setRevPage(p => p + 1)} style={{ flex: 1, background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px", cursor: revPage * 10 < revTotal ? "pointer" : "default", opacity: revPage * 10 < revTotal ? 1 : 0.4 }}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
function AiChat({ token }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm TTP AI. I have live access to your Azure SQL database. Ask me about bookings, revenue, PAX, or trends — and I'll ask back if I need more info to give you the right numbers." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, history }),
      });
      if (res.status === 401) {
        try { logoutFn(); } catch (_) {}
        return;
      }
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.error || "No response" }]);
    } catch (_) {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", background: m.role === "user" ? C.accent : C.card,
              border: m.role === "assistant" ? `1px solid ${C.border}` : "none",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "12px 16px", color: C.text, fontSize: 14, lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 4, padding: "12px 16px", background: C.card, borderRadius: 12, width: "fit-content", border: `1px solid ${C.border}` }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.accentHi, animation: "pulse 1s infinite", animationDelay: `${i*0.2}s` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      {/* Quick prompts */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, marginTop: 12 }}>
        {["What is our total revenue?", "Solmar confirmed bookings 2026", "Show cancellation rate", "Compare 2025 vs 2024"].map(q => (
          <button key={q} onClick={() => { setInput(q); }} style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{q}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "12px 0" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about bookings, revenue, trends…"
          style={{ flex: 1, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
        <button onClick={send} disabled={loading} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", cursor: loading ? "default" : "pointer", fontSize: 16, opacity: loading ? 0.5 : 1 }}>→</button>
      </div>
    </div>
  );
}

// ─── BUS OCCUPANCY ────────────────────────────────────────────────────────────
function BusOccupancy({ token }) {
  const [busTab, setBusTab] = useState("pendel");
  const [slicers, setSlicers] = useState({ pendels: [], regions: [], destinations: [], feederLines: [] });
  const [filters, setBusF] = useState({ dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: `${new Date().getFullYear()}-12-31`, region: "", destination: "", weekday: "", feederLine: "", feederLabel: "" });
  const [kpis, setKpis] = useState({});
  const [pendel, setPendel] = useState([]);
  const [feeder, setFeeder] = useState([]);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    safeApiFetch("/api/dashboard/bus-slicers", {}, token).then(d => { if (d && !d.error) setSlicers(d); }).catch(() => {});
  }, [token]);

  const load = useCallback((f) => {
    if (!token) return;
    setLoading(true);
    const p = {};
    if (f.dateFrom) p.dateFrom = f.dateFrom;
    if (f.dateTo) p.dateTo = f.dateTo;
    if (f.region) p.region = f.region;
    if (f.destination) p.destination = f.destination;
    if (f.weekday) p.weekday = f.weekday;
    const feederP = { ...p };
    if (f.feederLine) feederP.feederLine = f.feederLine;
    if (f.feederLabel) feederP.label = f.feederLabel;
    Promise.all([
      safeApiFetch("/api/dashboard/bus-kpis", p, token).catch(() => ({})),
      safeApiFetch("/api/dashboard/pendel-overview", p, token).catch(() => []),
      safeApiFetch("/api/dashboard/feeder-overview", feederP, token).catch(() => []),
      safeApiFetch("/api/dashboard/deck-class", p, token).catch(() => []),
    ]).then(([k, pe, fe, de]) => {
      if (k && !k.error) setKpis(k);
      if (Array.isArray(pe)) setPendel(pe);
      if (Array.isArray(fe)) setFeeder(fe);
      if (Array.isArray(de)) setDeck(de);
    }).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(filters); }, []);

  const inp = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, outline: "none", width: "100%" };

  const KPI_ITEMS = [
    { label: "Total PAX", value: kpis.total_pax, color: C.accent },
    { label: "Bookings", value: kpis.total_bookings, color: C.success },
    { label: "Royal Class", value: kpis.royal_pax, color: C.purple },
    { label: "First Class", value: kpis.first_pax, color: C.accentHi },
    { label: "Premium Class", value: kpis.premium_pax, color: C.teal },
    { label: "Comfort Class", value: kpis.comfort_pax, color: C.warn },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontWeight: 700, fontSize: 20, margin: 0 }}>🚌 Solmar Bus Occupancy</h2>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>DEF confirmed bookings only</div>
        </div>
        <button onClick={() => setShowFilter(v => !v)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: C.textMid, cursor: "pointer", fontSize: 13 }}>
          {showFilter ? "✕ Close Filter" : "⚙ Filter"}
        </button>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 14 }}>
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>DATE FROM</div>
            <input type="date" value={filters.dateFrom} onChange={e => setBusF({ ...filters, dateFrom: e.target.value })} style={inp} />
          </div>
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>DATE TO</div>
            <input type="date" value={filters.dateTo} onChange={e => setBusF({ ...filters, dateTo: e.target.value })} style={inp} />
          </div>
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>REGION</div>
            <select value={filters.region} onChange={e => setBusF({ ...filters, region: e.target.value })} style={inp}>
              <option value="">All Regions</option>
              {slicers.regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>DESTINATION</div>
            <select value={filters.destination} onChange={e => setBusF({ ...filters, destination: e.target.value })} style={inp}>
              <option value="">All Destinations</option>
              {slicers.destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>WEEKDAY</div>
            <select value={filters.weekday} onChange={e => setBusF({ ...filters, weekday: e.target.value })} style={inp}>
              <option value="">All Days</option>
              {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {busTab === "feeder" && (
            <>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>FEEDER LINE</div>
                <select value={filters.feederLine} onChange={e => setBusF({ ...filters, feederLine: e.target.value })} style={inp}>
                  <option value="">All Lines</option>
                  {slicers.feederLines.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>LABEL</div>
                <select value={filters.feederLabel} onChange={e => setBusF({ ...filters, feederLabel: e.target.value })} style={inp}>
                  <option value="">All Labels</option>
                  <option value="Solmar">Solmar</option>
                  <option value="Interbus">Interbus</option>
                  <option value="Solmar DE">Solmar DE</option>
                </select>
              </div>
            </>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={() => load(filters)} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Apply</button>
            <button onClick={() => {
              const f = { dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: `${new Date().getFullYear()}-12-31`, region: "", destination: "", weekday: "", feederLine: "", feederLabel: "" };
              setBusF(f); load(f);
            }} style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 12px", cursor: "pointer", fontSize: 13 }}>Reset</button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {KPI_ITEMS.map(k => (
          <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{(k.value ?? 0).toLocaleString("nl-BE")}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.bg, padding: 4, borderRadius: 10, width: "fit-content", border: `1px solid ${C.border}` }}>
        {[["pendel", "Pendel Overview"], ["feeder", "Feeder Overview"], ["deck", "Deck Choice"]].map(([id, label]) => (
          <button key={id} onClick={() => setBusTab(id)} style={{ background: busTab === id ? C.accent : "transparent", color: busTab === id ? "#fff" : C.textMid, border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}>{label}</button>
        ))}
      </div>

      {loading && <div style={{ color: C.textDim, padding: 20 }}>Loading…</div>}
      {!loading && busTab === "pendel" && <PendelTable data={pendel} />}
      {!loading && busTab === "feeder" && <FeederTable data={feeder} />}
      {!loading && busTab === "deck" && <DeckTable data={deck} />}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth state — check localStorage on startup ───────────────────────────
  const [user, setUser] = useState(() => {
    const token = loadToken();
    if (!token || !isTokenValid(token)) {
      clearToken();
      return null;
    }
    const saved = loadUser();
    if (!saved) {
      clearToken();
      return null;
    }
    return { ...saved, token };
  });

  const [tab, setTab] = useState("overview");

  // ── Overview state ────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState(null);
  const [revByYear, setRevByYear] = useState([]);
  const [ymData, setYmData] = useState([]);
  const [ovLoad, setOvLoad] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ datasets: [], status: [], departureDateFrom: "", departureDateTo: "" });
  const [applied, setApplied] = useState({ ...filters });

  const token = user?.token;

  // ── Load overview data ────────────────────────────────────────────────────
  const loadOverview = useCallback(async (f) => {
    if (!token) return;
    setOvLoad(true);
    const p = {};
    if (f.departureDateFrom) p.departureDateFrom = f.departureDateFrom;
    if (f.departureDateTo)   p.departureDateTo   = f.departureDateTo;
    if (f.datasets?.length)  p.dataset = f.datasets;
    if (f.status?.length)    p.status  = f.status;
    try {
      const [kp, rv, ym] = await Promise.all([
        safeApiFetch("/api/dashboard/kpis", p, token).catch(() => null),
        safeApiFetch("/api/dashboard/revenue-by-year", p, token).catch(() => []),
        safeApiFetch("/api/dashboard/year-month-comparison", p, token).catch(() => []),
      ]);
      if (kp) setKpis(kp);
      if (Array.isArray(rv)) setRevByYear(rv);
      if (Array.isArray(ym)) setYmData(ym);
    } finally { setOvLoad(false); }
  }, [token]);

  useEffect(() => { if (token && tab === "overview") loadOverview(applied); }, [token, tab]);

  // ── Login / logout ────────────────────────────────────────────────────────
  const handleLogin = useCallback((u) => {
    saveToken(u.token, u);
    setUser(u);
  }, []);
  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Ensure safeApiFetch can call logout immediately (before effects run).
  logoutFn = handleLogout;

  useEffect(() => {
    // Extra guard for browser reopen with an expired/malformed token.
    if (user?.token && !isTokenValid(user.token)) {
      handleLogout();
    }
  }, [user?.token, handleLogout]);

  // ── If not logged in → show Login ─────────────────────────────────────────
  if (!user) return <Login onLogin={handleLogin} />;

  // ── Sort YM data: newest first ────────────────────────────────────────────
  const sortedYm = [...ymData].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });

  // ── Dataset filter chips ──────────────────────────────────────────────────
  const DATASETS = [
    { id: "Solmar", color: "#10b981" },
    { id: "Interbus", color: "#f59e0b" },
    { id: "Solmar DE", color: "#ef4444" },
    { id: "Snowtravel", color: "#3b82f6" },
  ];
  const toggleDataset = (id) => {
    const cur = filters.datasets || [];
    const next = cur.includes(id) ? cur.filter(d => d !== id) : [...cur, id];
    setFilters({ ...filters, datasets: next });
  };

  // ── Nav items ─────────────────────────────────────────────────────────────
  const navItems = [
    { id: "overview", icon: <LayoutDashboard size={16} />, label: "Overview" },
    { id: "bus", icon: <Bus size={16} />, label: "Bus Occupancy" },
    { id: "hotels", icon: <Hotel size={16} />, label: "Hotel Reviews" },
    { id: "data", icon: <LayoutDashboard size={16} />, label: "Data Table" },
    { id: "ai", icon: <Bot size={16} />, label: "TTP AI" },
  ];
  const mgmtItems = user.role === "admin" ? [
    { id: "settings", icon: <Settings size={16} />, label: "Settings" },
  ] : [];

  const inp = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <div style={{ width: 220, minWidth: 220, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${C.accent}, ${C.accentHi})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={20} color="#e5f2ff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1 }}>TTP Services</div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Analytics</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
          {navItems.map(n => (
            <div key={n.id} onClick={() => setTab(n.id)}
              style={{ padding: "10px 12px", cursor: "pointer", borderRadius: 8, background: tab === n.id ? C.accentSoft : "transparent", color: tab === n.id ? C.accentHi : C.textMid, marginBottom: 2, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: tab === n.id ? 600 : 400, transition: "all 0.15s", borderLeft: tab === n.id ? `3px solid ${C.accentHi}` : "3px solid transparent" }}>
              <span>{n.icon}</span> {n.label}
            </div>
          ))}
          {mgmtItems.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", padding: "16px 12px 6px", fontWeight: 700 }}>Management</div>
              {mgmtItems.map(n => (
                <div key={n.id} onClick={() => setTab(n.id)}
                  style={{ padding: "10px 12px", cursor: "pointer", borderRadius: 8, background: tab === n.id ? C.accentSoft : "transparent", color: tab === n.id ? C.accentHi : C.textMid, marginBottom: 2, display: "flex", alignItems: "center", gap: 10, fontSize: 13, borderLeft: tab === n.id ? `3px solid ${C.accentHi}` : "3px solid transparent" }}>
                  <span>{n.icon}</span> {n.label}
                </div>
              ))}
            </>
          )}
        </div>

        {/* User section */}
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 4 }}>{user.username || user.name || "User"}</div>
          <button onClick={handleLogout} style={{ width: "100%", background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── FILTER BAR (Overview only) ─────────────────────────────────── */}
        {tab === "overview" && (
          <div style={{ padding: "12px 24px", background: C.sidebar, borderBottom: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            {/* Dataset chips */}
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Dataset</div>
              <div style={{ display: "flex", gap: 6 }}>
                {DATASETS.map(d => {
                  const active = filters.datasets.includes(d.id);
                  return (
                    <button key={d.id} onClick={() => toggleDataset(d.id)}
                      style={{ background: active ? d.color + "33" : C.bg, color: active ? d.color : C.textDim, border: `1px solid ${active ? d.color : C.border}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400 }}>
                      {d.id}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Status */}
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Status</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ id: "ok", label: "Confirmed", color: C.success }, { id: "cancelled", label: "Cancelled", color: C.danger }].map(s => {
                  const active = filters.status?.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => {
                      const cur = filters.status || [];
                      setFilters({ ...filters, status: cur.includes(s.id) ? cur.filter(x => x !== s.id) : [...cur, s.id] });
                    }}
                      style={{ background: active ? s.color + "22" : C.bg, color: active ? s.color : C.textDim, border: `1px solid ${active ? s.color : C.border}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400 }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Date range */}
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Departure From</div>
              <input type="date" value={filters.departureDateFrom} onChange={e => setFilters({ ...filters, departureDateFrom: e.target.value })} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Departure To</div>
              <input type="date" value={filters.departureDateTo} onChange={e => setFilters({ ...filters, departureDateTo: e.target.value })} style={inp} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button onClick={() => { setApplied({ ...filters }); loadOverview(filters); }}
                style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Apply</button>
              <button onClick={() => { const f = { datasets: [], status: [], departureDateFrom: "", departureDateTo: "" }; setFilters(f); setApplied(f); loadOverview(f); }}
                style={{ background: C.card, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 12px", cursor: "pointer", fontSize: 13 }}>Reset</button>
            </div>
          </div>
        )}

        {/* ── PAGE CONTENT ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ color: C.text, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.02em" }}>Overview</h1>
                <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>
                  {kpis?.periodLabel ? `Showing: ${kpis.periodLabel}` : "All data · All datasets"}
                  {ovLoad && <span style={{ marginLeft: 10, color: C.textDim }}>Refreshing…</span>}
                </div>
              </div>

              {/* KPI Cards */}
              {kpis && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
                  <KpiCard label="Bookings" current={kpis.currentBookings} previous={kpis.previousBookings} diff={kpis.differenceBookings} pct={kpis.percentBookings} format="number" prevLabel={kpis.prevLabel} color={C.accent} />
                  <KpiCard label="PAX" current={kpis.currentPax} previous={kpis.previousPax} diff={kpis.differencePax} pct={kpis.percentPax} format="number" prevLabel={kpis.prevLabel} color={C.success} />
                  <KpiCard label="Revenue" current={kpis.currentRevenue} previous={kpis.previousRevenue} diff={kpis.differenceRevenue} pct={kpis.percentRevenue} format="currency_k" prevLabel={kpis.prevLabel} color={C.warn} />
                </div>
              )}

              {/* Revenue Line Chart */}
              {revByYear.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 22 }}>
                  <BarChart
                    data={revByYear}
                    metric="revenue"
                    title="Monthly Revenue by Month"
                  />
                  <div style={{ height: 16 }} />
                  <LineChart
                    data={revByYear}
                    dateFrom={applied.departureDateFrom}
                    metric="revenue"
                    title="Monthly Revenue by Year"
                  />
                </div>
              )}

              {/* Year-Month Comparison Table */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "0", overflow: "hidden" }}>
                <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Year-on-Year Comparison</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>← scroll right for more →</div>
                </div>
                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 520 }}>
                  <table style={{ borderCollapse: "collapse", minWidth: "100%", fontSize: 13 }}>
                    <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
                      <tr>
                        {[
                          { k: "period", l: "Period" },
                          { k: "currentBookings", l: `Bookings (${kpis?.periodLabel || new Date().getFullYear()})` },
                          { k: "previousBookings", l: `Bookings (${kpis?.prevLabel || new Date().getFullYear() - 1})` },
                          { k: "diffBookings", l: "Δ Bookings" },
                          { k: "diffPctBookings", l: "Δ%" },
                          { k: "currentPax", l: `PAX (${kpis?.periodLabel || new Date().getFullYear()})` },
                          { k: "previousPax", l: `PAX (${kpis?.prevLabel || new Date().getFullYear() - 1})` },
                          { k: "diffPax", l: "Δ PAX" },
                          { k: "currentRevenue", l: `Revenue (${kpis?.periodLabel || new Date().getFullYear()})` },
                          { k: "previousRevenue", l: `Revenue (${kpis?.prevLabel || new Date().getFullYear() - 1})` },
                          { k: "diffRevenue", l: "Δ Revenue" },
                          { k: "diffPctRevenue", l: "Δ%" },
                        ].map(h => (
                          <th key={h.k} style={{ padding: "11px 14px", textAlign: h.k === "period" ? "left" : "right", color: C.textMid, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                            {h.l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedYm.map((r, i) => {
                        const fmtRev = v => v != null ? `€${(v/1000).toFixed(0)}K` : "—";
                        const fmtPct = v => v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—";
                        const isUp = v => v > 0;
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                            <td style={{ padding: "9px 14px", color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {MONTHS_SHORT[r.month - 1]} {r.year}
                            </td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: C.text }}>{r.currentBookings?.toLocaleString("nl-BE") ?? "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: C.textMid }}>{r.previousBookings != null ? r.previousBookings?.toLocaleString("nl-BE") : "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: r.diffBookings > 0 ? C.success : r.diffBookings < 0 ? C.danger : C.textMid }}>{r.diffBookings != null ? (r.diffBookings > 0 ? "+" : "") + r.diffBookings : "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: r.diffPctBookings > 0 ? C.success : r.diffPctBookings < 0 ? C.danger : C.textMid, fontWeight: 700 }}>{fmtPct(r.diffPctBookings)}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: C.text }}>{r.currentPax?.toLocaleString("nl-BE") ?? "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: C.textMid }}>{r.previousPax != null ? r.previousPax?.toLocaleString("nl-BE") : "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: r.diffPax > 0 ? C.success : r.diffPax < 0 ? C.danger : C.textMid }}>{r.diffPax != null ? (r.diffPax > 0 ? "+" : "") + r.diffPax : "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: C.text }}>{fmtRev(r.currentRevenue)}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: C.textMid }}>{r.previousRevenue != null ? fmtRev(r.previousRevenue) : "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: r.diffRevenue > 0 ? C.success : r.diffRevenue < 0 ? C.danger : C.textMid }}>{r.diffRevenue != null ? (r.diffRevenue > 0 ? "+" : "") + (r.diffRevenue/1000).toFixed(0) + "K" : "—"}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: r.diffPctRevenue > 0 ? C.success : r.diffPctRevenue < 0 ? C.danger : C.textMid, fontWeight: 700 }}>{fmtPct(r.diffPctRevenue)}</td>
                          </tr>
                        );
                      })}
                      {!sortedYm.length && (
                        <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: C.textDim }}>{ovLoad ? "Loading…" : "No data"}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── BUS OCCUPANCY ─────────────────────────────────────────────── */}
          {tab === "bus" && <BusOccupancy token={token} />}

          {/* ── HOTEL REVIEWS ─────────────────────────────────────────────── */}
          {tab === "hotels" && <HotelTab token={token} />}

          {/* ── DATA TABLE ────────────────────────────────────────────────── */}
          {tab === "data" && <DataTable token={token} />}

          {/* ── AI CHAT ───────────────────────────────────────────────────── */}
          {tab === "ai" && <AiChat token={token} />}

          {/* ── SETTINGS ──────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <div style={{ maxWidth: 640 }}>
              <h2 style={{ color: C.text, fontWeight: 700, margin: "0 0 20px" }}>Settings</h2>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
                <h3 style={{ color: C.text, margin: "0 0 12px", fontSize: 15 }}>Account</h3>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 2 }}>
                  <div><span style={{ color: C.textDim }}>User: </span>{user.username || user.name}</div>
                  <div><span style={{ color: C.textDim }}>Role: </span>{user.role}</div>
                  <div><span style={{ color: C.textDim }}>Backend: </span><a href={BASE + "/health"} target="_blank" rel="noreferrer" style={{ color: C.accentHi }}>{BASE}</a></div>
                </div>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                <h3 style={{ color: C.text, margin: "0 0 12px", fontSize: 15 }}>Data Sources</h3>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 2 }}>
                  <div>✅ CustomerOverview — Solmar / Interbus / Solmar DE</div>
                  <div>✅ ST_Bookings — Snowtravel</div>
                  <div>✅ BUStrips — Pendel overview</div>
                  <div>✅ FeederOverview — Feeder stops</div>
                  <div>✅ solmar_bus_deck_weekly — Deck choice</div>
                  <div>✅ HotelRatings / HotelReviews — TravelTrustIt API</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.textDim}; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); }
        @keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }
      `}</style>
    </div>
  );
}
