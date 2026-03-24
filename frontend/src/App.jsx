import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./components/Login.jsx";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#3b82f6","#10b981","#f59e0b","#ec4899"];
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "https://ttp-dashboard-api-dpczbed3bvhchxe9.belgiumcentral-01.azurewebsites.net";

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
    inputBg: "#ffffff", shadow: "0 1px 3px rgba(0,0,0,0.1)"
  }
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function buildParams(f = {}) {
  const p = {};
  if (f.departureDateFrom) p.departureDateFrom = f.departureDateFrom;
  if (f.departureDateTo)   p.departureDateTo   = f.departureDateTo;
  if (f.bookingDateFrom)   p.bookingDateFrom   = f.bookingDateFrom;
  if (f.bookingDateTo)     p.bookingDateTo     = f.bookingDateTo;
  if (f.datasets?.length)  p.datasets          = f.datasets;
  if (f.statuses?.length)  p.statuses          = f.statuses;
  return p;
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

const YMTable = ({ data, T }) => {
  // NEW SAFETY CHECK
  if (!data || !Array.isArray(data)) {
    return <div style={{ padding: 20, color: T.muted }}>Loading data from Azure...</div>;
  }

  // ISSUE 1 FIX: Sort by Year DESC, then Month DESC
  const sorted = [...(data || [])].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });

  return (
    <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: T.tableHead, borderBottom: `1px solid ${T.border}` }}>
          <tr>
            <th style={{ padding: "12px 16px", textAlign: "left", color: T.muted }}>Period</th>
            <th style={{ padding: "12px 16px", textAlign: "right", color: T.muted }}>Bookings</th>
            <th style={{ padding: "12px 16px", textAlign: "right", color: T.muted }}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${T.border}` : "none" }}>
              {/* ISSUE 1 FIX: Format as Jan-2026 */}
              <td style={{ padding: "12px 16px", fontWeight: 500 }}>{MONTHS[row.month-1]}-{row.year}</td>
              <td style={{ padding: "12px 16px", textAlign: "right" }}>{row.currentBookings?.toLocaleString()}</td>
              <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>€{row.currentRevenue?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FiltersBar = ({ filters, setFilters, onApply, onReset, T }) => {
  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 24px", background: T.sidebar, borderBottom: `1px solid ${T.border}`, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>DEPARTURE RANGE</label>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="date" value={filters.departureDateFrom || ""} onChange={e => setFilters(f => ({ ...f, departureDateFrom: e.target.value }))} style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12 }} />
          <span style={{ color: T.muted }}>→</span>
          <input type="date" value={filters.departureDateTo || ""} onChange={e => setFilters(f => ({ ...f, departureDateTo: e.target.value }))} style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12 }} />
        </div>
      </div>

      {/* ISSUE 6 FIX: Status Buttons with Colors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>STATUS</label>
        <div style={{ display: "flex", gap: 4 }}>
          {['ok', 'cancelled'].map(s => {
            const active = filters.statuses?.includes(s);
            const color = s === 'ok' ? T.success : T.danger;
            return (
              <button key={s} onClick={() => setFilters(f => ({ ...f, statuses: active ? [] : [s] }))}
                style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${active ? color : T.border}`, 
                background: active ? (s === 'ok' ? T.successBg : T.dangerBg) : T.card, 
                color: active ? color : T.text, fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={onApply} style={{ marginTop: "auto", padding: "8px 16px", background: T.accent, color: "#fff", borderRadius: 6, border: "none", fontWeight: 600, cursor: "pointer" }}>Apply</button>
      <button onClick={onReset} style={{ marginTop: "auto", padding: "8px 16px", color: T.muted, background: "transparent", border: "none", cursor: "pointer" }}>Reset</button>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("overview");
  const [filters, setFilters] = useState({ datasets: [], statuses: [], departureDateFrom: "", departureDateTo: "" });
  const [applied, setApplied] = useState({ ...filters });
  const [kpis, setKpis] = useState({});
  const [ymData, setYmData] = useState([]);
  const T = THEMES.gray;

  const fetchData = useCallback(async () => {
    // 1. Pull the token from storage
    const token = localStorage.getItem("token");

    // 2. If no token, don't even try to fetch (avoids 401 loop)
    if (!token) {
      console.error("No token found, redirecting to login...");
      setUser(null);
      return;
    }

    try {
      const p = buildParams(applied);
      const qs = new URLSearchParams(p).toString();
      const res = await fetch(`${BASE}/api/dashboard/kpis?${qs}`, {
        headers: {
          "Authorization": `Bearer ${token}`, // Ensure 'Bearer ' is included
          "Content-Type": "application/json"
        }
      });

      if (res.status === 401) {
        localStorage.removeItem("token"); // Clear bad token
        setUser(null);
        return;
      }

      const data = await res.json();
      setKpis(data);

      const res2 = await fetch(`${BASE}/api/dashboard/year-month?${qs}`, {
        headers: {
          "Authorization": `Bearer ${token}`, // Ensure 'Bearer ' is included
          "Content-Type": "application/json"
        }
      });

      if (res2.status === 401) {
        localStorage.removeItem("token"); // Clear bad token
        setUser(null);
        return;
      }

      const data2 = await res2.json();
      setYmData(data2);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [applied]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user) return <Login onLogin={setUser} BASE={BASE} /> ;

  // ISSUE 2 FIX: Sidebar with Settings for Admin
  const navItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "data",     label: "Data Table", icon: "📋" },
    { id: "ai",       label: "TTP AI",    icon: "✨" },
  ];
  if (user.role === 'admin') navItems.push({ id: "settings", label: "Settings", icon: "⚙️" });

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, fontFamily: "Inter, system-ui" }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: T.sidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 24, fontSize: 18, fontWeight: 800, color: T.accent }}>TTP ANALYTICS</div>
        <div style={{ flex: 1, padding: "0 12px" }}>
          {navItems.map(item => (
            <div key={item.id} onClick={() => setTab(item.id)} style={{ 
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, cursor: "pointer",
              background: tab === item.id ? T.accentLight : "transparent", color: tab === item.id ? T.accent : T.textSub,
              fontWeight: tab === item.id ? 600 : 500, marginBottom: 4
            }}>
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <FiltersBar filters={filters} setFilters={setFilters} onApply={() => setApplied({...filters})} onReset={() => setFilters({datasets:[], statuses:[], departureDateFrom:"", departureDateTo:""})} T={T} />
        
        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {tab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 32 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, height: "fit-content" }}>
                <KPICard label="Bookings" value={kpis.currentBookings} T={T} />
                <KPICard label="PAX" value={kpis.currentPax} T={T} />
                <KPICard label="Revenue" value={`€${(kpis.currentRevenue || 0).toLocaleString()}`} T={T} />
              </div>
              <YMTable data={ymData} T={T} />
            </div>
          )}
          {tab === 'data' && (
            <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Raw Booking Records</h3>
                <button
                  onClick={() => window.open(`${BASE}/api/dashboard/export?${new URLSearchParams(applied).toString()}&token=${user.token}`)}
                  style={{ background: T.success || '#10b981', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  📥 Export CSV
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <DataTable filters={applied} token={user.token} T={T} />
              </div>
            </div>
          )}
          {tab === "settings" && <div style={{ padding: 20 }}><h2>Settings</h2><p>Admin panel for users and themes.</p></div>}
          {tab === "ai" && <div style={{ padding: 20 }}><h2>TTP AI Chat</h2><p>Ask questions about your data...</p></div>}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, T }) {
  return (
    <div style={{ background: T.card, padding: 24, borderRadius: 12, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
      <div style={{ color: T.muted, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value?.toLocaleString() || 0}</div>
    </div>
  );
}

function DataTable({ filters, token, T }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams(filters).toString();
    fetch(`${BASE}/api/dashboard/export?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(l => l.trim());
        const data = lines.slice(1).map(line => line.split(','));
        setRows(data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filters, token]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading records...</div>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead style={{ background: T.tableHead || '#f9fafb' }}>
        <tr style={{ textAlign: 'left', borderBottom: `2px solid ${T.border}` }}>
          <th style={{ padding: 12 }}>Booking ID</th>
          <th style={{ padding: 12 }}>Dataset</th>
          <th style={{ padding: 12 }}>PAX</th>
          <th style={{ padding: 12 }}>Revenue</th>
          <th style={{ padding: 12 }}>Departure</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
            <td style={{ padding: 12 }}>{r[0]}</td>
            <td style={{ padding: 12 }}>{r[1]}</td>
            <td style={{ padding: 12 }}>{r[6]}</td>
            <td style={{ padding: 12 }}>€{parseFloat(r[7] || 0).toLocaleString()}</td>
            <td style={{ padding: 12 }}>{r[4]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}