import { useState, useEffect, useCallback, useRef } from "react";
import Login from "./Login.jsx";
import {
  fetchKpis, fetchYearMonthComparison, fetchRevenueByYear,
  fetchSlicers, fetchBusOccupancy, fetchTransportBreakdown,
  fetchDeparturePlaces
} from "./api.js";
import { KpiCards } from "./components/KpiCards.jsx";
import { RevenueLineChart } from "./components/RevenueLineChart.jsx";
import { TrendChart } from "./components/TrendChart.jsx";
import { YearMonthTable } from "./components/YearMonthTable.jsx";
import { BreakdownCharts } from "./components/BreakdownCharts.jsx";
import { BusOccupancyView } from "./components/BusOccupancyView.jsx";
import { Slicers } from "./components/Slicers.jsx";
import { MapView } from "./components/MapView.jsx";
import AiView from "./components/AiView.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: "⬡" },
  { id: "bus",      label: "Bus Occupancy", icon: "⬡" },
  { id: "data",     label: "Data Table", icon: "⬡" },
  { id: "hotel",    label: "Hotel", icon: "⬡" },
  { id: "ai",       label: "TTP AI", icon: "✦" },
];

const DATASETS = ["Solmar", "Interbus", "Solmar DE", "Snowtravel"];
const YEARS    = ["2023","2024","2025","2026"];

const emptyFilters = () => ({
  datasets: [],
  year: [],
  departureDateFrom: "",
  departureDateTo: "",
  returnDateFrom: "",
  returnDateTo: "",
  transportType: "",
  status: "",
});

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const t = localStorage.getItem("ttp_token") || sessionStorage.getItem("ttp_token");
      const u = localStorage.getItem("ttp_user") || sessionStorage.getItem("ttp_user");
      return t && u ? { ...JSON.parse(u), token: t } : null;
    } catch { return null; }
  });

  const [tab, setTab]             = useState("overview");
  const [metric, setMetric]       = useState("bookings");
  const [filters, setFilters]     = useState(emptyFilters());
  const [applied, setApplied]     = useState(emptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Data state
  const [kpiData,      setKpiData]      = useState(null);
  const [ymData,       setYmData]       = useState([]);
  const [revenueData,  setRevenueData]  = useState([]);
  const [breakdownData,setBreakdownData] = useState(null);
  const [busData,      setBusData]      = useState(null);
  const [mapData,      setMapData]      = useState([]);
  const [slicerOpts,   setSlicerOpts]   = useState({ transportTypes: [] });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [lastSync,     setLastSync]     = useState(null);
  const [spinning,     setSpinning]     = useState(false);

  const handleLogin = useCallback((token, userData) => {
    setUser({ ...userData, token });
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("ttp_token");
    localStorage.removeItem("ttp_user");
    sessionStorage.removeItem("ttp_token");
    sessionStorage.removeItem("ttp_user");
    setUser(null);
  }, []);

  // Build filter params
  const buildParams = useCallback((f) => {
    const p = {};
    if (f.datasets?.length)       p.dataset = f.datasets;
    if (f.year?.length)           p.year    = f.year;
    if (f.departureDateFrom)      p.departureDateFrom = f.departureDateFrom;
    if (f.departureDateTo)        p.departureDateTo   = f.departureDateTo;
    if (f.returnDateFrom)         p.returnDateFrom    = f.returnDateFrom;
    if (f.returnDateTo)           p.returnDateTo      = f.returnDateTo;
    if (f.transportType)          p.transportType     = f.transportType;
    if (f.status)                 p.status            = f.status;
    return p;
  }, []);

  const loadAll = useCallback(async (f, quiet = false) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    setSpinning(true);
    setError("");
    const p = buildParams(f);
    try {
      const [kpis, ym, rev, breakdown, bus, places] = await Promise.allSettled([
        fetchKpis(p),
        fetchYearMonthComparison(p),
        fetchRevenueByYear(p),
        fetchTransportBreakdown(p),
        fetchBusOccupancy(p),
        fetchDeparturePlaces(p),
      ]);
      if (kpis.status === "fulfilled")      setKpiData(kpis.value);
      if (ym.status === "fulfilled")        setYmData(Array.isArray(ym.value) ? ym.value : []);
      if (rev.status === "fulfilled")       setRevenueData(Array.isArray(rev.value) ? rev.value : []);
      if (breakdown.status === "fulfilled") setBreakdownData(breakdown.value);
      if (bus.status === "fulfilled")       setBusData(bus.value);
      if (places.status === "fulfilled")    setMapData(Array.isArray(places.value) ? places.value : []);
      setLastSync(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, [user, buildParams]);

  // Load slicers once
  useEffect(() => {
    if (!user) return;
    fetchSlicers().then(d => setSlicerOpts(d)).catch(() => {});
  }, [user]);

  // Load on mount and when applied filters change
  useEffect(() => {
    loadAll(applied);
  }, [applied, loadAll]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => loadAll(applied, true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, applied, loadAll]);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const hasActiveFilters =
    applied.datasets?.length || applied.year?.length ||
    applied.departureDateFrom || applied.departureDateTo ||
    applied.status || applied.transportType;

  const fmtSync = (d) => {
    if (!d) return null;
    const h = d.getHours().toString().padStart(2,"0");
    const m = d.getMinutes().toString().padStart(2,"0");
    return `${h}:${m}`;
  };

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
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">
              {(user.name || user.username || "U")[0].toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name || user.username}</span>
              <span className="user-role">{user.role || "User"}</span>
            </div>
          </div>
          {lastSync && (
            <div className="sync-status">
              <span className="sync-dot" />
              Last sync {fmtSync(lastSync)}
            </div>
          )}
          <button className="btn-logout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="main-area">

        {/* ── TOPBAR ── */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">
              {TABS.find(t => t.id === tab)?.label}
            </h1>
            {hasActiveFilters && (
              <div className="active-filters-row">
                {applied.datasets?.map(d => (
                  <span key={d} className="filter-chip dataset">{d}</span>
                ))}
                {applied.year?.map(y => (
                  <span key={y} className="filter-chip year">{y}</span>
                ))}
                {applied.status && (
                  <span className="filter-chip status">{applied.status}</span>
                )}
                {(applied.departureDateFrom || applied.departureDateTo) && (
                  <span className="filter-chip date">
                    {applied.departureDateFrom || "…"} → {applied.departureDateTo || "…"}
                  </span>
                )}
                <button
                  className="chip-clear"
                  onClick={() => { setFilters(emptyFilters()); setApplied(emptyFilters()); }}
                >
                  ✕ Reset all
                </button>
              </div>
            )}
          </div>

          <div className="topbar-actions">
            {tab === "overview" && (
              <div className="metric-tabs">
                {[
                  { id: "bookings", label: "Bookings" },
                  { id: "pax",      label: "PAX" },
                  { id: "turnover", label: "Revenue" },
                ].map(m => (
                  <button
                    key={m.id}
                    className={`metric-tab ${metric === m.id ? "active" : ""}`}
                    onClick={() => setMetric(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            <button
              className={`btn-icon ${spinning ? "spinning" : ""}`}
              onClick={() => loadAll(applied, true)}
              title="Refresh data"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0018.49 15"/>
              </svg>
            </button>

            <button
              className={`btn-filter ${filtersOpen ? "active" : ""} ${hasActiveFilters ? "has-active" : ""}`}
              onClick={() => setFiltersOpen(o => !o)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
              {hasActiveFilters && <span className="filter-badge" />}
            </button>
          </div>
        </header>

        {/* ── FILTER DRAWER ── */}
        <div className={`filter-drawer ${filtersOpen ? "open" : ""}`}>
          <div className="filter-drawer-inner">
            {/* Dataset chips */}
            <div className="filter-section">
              <label className="filter-label">Dataset</label>
              <div className="chip-group">
                {DATASETS.map(ds => (
                  <button
                    key={ds}
                    className={`ds-chip ${filters.datasets?.includes(ds) ? "active" : ""}`}
                    onClick={() => {
                      const cur = filters.datasets || [];
                      setFilters(f => ({
                        ...f,
                        datasets: cur.includes(ds) ? cur.filter(x => x !== ds) : [...cur, ds]
                      }));
                    }}
                  >
                    {ds}
                  </button>
                ))}
              </div>
            </div>

            {/* Year chips */}
            <div className="filter-section">
              <label className="filter-label">Year</label>
              <div className="chip-group">
                {YEARS.map(y => (
                  <button
                    key={y}
                    className={`ds-chip ${filters.year?.includes(y) ? "active" : ""}`}
                    onClick={() => {
                      const cur = filters.year || [];
                      setFilters(f => ({
                        ...f,
                        year: cur.includes(y) ? cur.filter(x => x !== y) : [...cur, y]
                      }));
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Date ranges */}
            <div className="filter-section">
              <label className="filter-label">Departure Date</label>
              <div className="date-range">
                <input type="date" className="date-input"
                  value={filters.departureDateFrom || ""}
                  onChange={e => setFilters(f => ({ ...f, departureDateFrom: e.target.value }))} />
                <span className="date-sep">→</span>
                <input type="date" className="date-input"
                  value={filters.departureDateTo || ""}
                  onChange={e => setFilters(f => ({ ...f, departureDateTo: e.target.value }))} />
              </div>
            </div>

            {/* Status */}
            <div className="filter-section">
              <label className="filter-label">Status</label>
              <div className="chip-group">
                {[{v:"",l:"All"},{v:"ok",l:"Confirmed"},{v:"cancelled",l:"Cancelled"}].map(s => (
                  <button
                    key={s.v}
                    className={`ds-chip ${(filters.status || "") === s.v ? "active" : ""}`}
                    onClick={() => setFilters(f => ({ ...f, status: s.v }))}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-actions">
              <button className="btn-clear-filters"
                onClick={() => setFilters(emptyFilters())}>
                Clear
              </button>
              <button className="btn-apply-filters"
                onClick={() => { setApplied({ ...filters }); setFiltersOpen(false); }}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* ── PAGE BODY ── */}
        <main className="page-body">
          {error && (
            <div className="error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {loading && (
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
          )}

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div className="tab-content">
              <KpiCards data={kpiData} />

              <div className="charts-row">
                <div className="chart-card wide">
                  <div className="card-header">
                    <span className="card-title">Revenue by Year</span>
                  </div>
                  <RevenueLineChart data={revenueData} />
                </div>
                <div className="chart-card">
                  <div className="card-header">
                    <span className="card-title">Bookings / PAX by Year</span>
                  </div>
                  <TrendChart data={ymData} metric={metric} />
                </div>
              </div>

              <div className="section-card">
                <div className="card-header">
                  <span className="card-title">Year-Month Comparison</span>
                  <span className="card-badge">
                    {hasActiveFilters ? "Filtered" : "All data"}
                  </span>
                </div>
                <YearMonthTable data={ymData} metric={metric} />
              </div>

              <BreakdownCharts data={breakdownData} metric={metric} />
            </div>
          )}

          {/* BUS OCCUPANCY TAB */}
          {tab === "bus" && (
            <BusOccupancyView data={busData} appliedFilters={applied} />
          )}

          {/* DATA TABLE TAB */}
          {tab === "data" && (
            <div className="tab-content">
              <MapView data={mapData} />
            </div>
          )}

          {/* HOTEL TAB */}
          {tab === "hotel" && (
            <div className="tab-content">
              <div className="placeholder-card">
                <div className="placeholder-icon">🏨</div>
                <h3>Hotel Reviews</h3>
                <p>Hotel review data is being loaded from TravelTrustIt API.</p>
              </div>
            </div>
          )}

          {/* AI TAB */}
          {tab === "ai" && (
            <AiView user={user} kpiData={kpiData} />
          )}
        </main>
      </div>
    </div>
  );
}
