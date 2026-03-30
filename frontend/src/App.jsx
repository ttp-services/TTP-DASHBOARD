import React, { useEffect, useMemo, useState } from "react";

const BASE = "https://ttp-dashboard-api.azurewebsites.net";

const YEAR_COLOR_MAP = {
  2022: "#8b5cf6",
  2023: "#f59e0b",
  2024: "#22c55e",
  2025: "#3b82f6",
  2026: "#ef4444",
  2027: "#14b8a6"
};

const formatDateRange = (from, to) => {
  if (!from && !to) return "All Time";
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
};

export default function App() {
  const [token, setToken] = useState("");
  const [kpis, setKpis] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [yoy, setYoy] = useState([]);
  const [stats, setStats] = useState(null);
  const [ratings, setRatings] = useState([]);

  const [applied, setApplied] = useState({
    depFrom: "",
    depTo: ""
  });

  // 🔐 AUTH VALIDATION (FIXED)
  useEffect(() => {
    const t = localStorage.getItem("ttp_token");

    if (!t) {
      setToken("");
      return;
    }

    fetch(`${BASE}/api/auth/validate`, {
      headers: { Authorization: `Bearer ${t}` }
    })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(() => setToken(t))
      .catch(() => {
        localStorage.removeItem("ttp_token");
        sessionStorage.removeItem("ttp_token");
        setToken("");
      });
  }, []);

  // 📊 LOAD DATA
  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${BASE}/api/dashboard/kpis`, { headers })
      .then(r => r.json())
      .then(setKpis);

    fetch(`${BASE}/api/dashboard/revenue`, { headers })
      .then(r => r.json())
      .then(setRevenue);

    fetch(`${BASE}/api/dashboard/yoy`, { headers })
      .then(r => r.json())
      .then(setYoy);

    fetch(`${BASE}/api/dashboard/hotel-stats`, { headers })
      .then(r => r.json())
      .then(data => {
        console.log("Hotel stats:", data);
        setStats(data);
      });

    fetch(`${BASE}/api/dashboard/hotel-ratings`, { headers })
      .then(r => r.json())
      .then(data => {
        console.log("Ratings:", data);
        setRatings(data);
      });

  }, [token]);

  // 📊 SORT REVENUE (FIXED)
  const sortedRevenue = useMemo(() => {
    return [...revenue].sort((a, b) => {
      return new Date(a.year, a.month - 1) - new Date(b.year, b.month - 1);
    });
  }, [revenue]);

  const groupedRevenue = useMemo(() => {
    const byYear = {};
    sortedRevenue.forEach(d => {
      if (!byYear[d.year]) byYear[d.year] = [];
      byYear[d.year].push(d);
    });
    return byYear;
  }, [sortedRevenue]);

  // ❌ NOT LOGGED IN
  if (!token) {
    return <div style={{ padding: 40 }}>Login required</div>;
  }

  return (
    <div style={{ padding: 20 }}>

      {/* KPI SECTION */}
      <h2>Overview</h2>
      <p>{formatDateRange(applied.depFrom, applied.depTo)}</p>

      <div style={{ display: "flex", gap: 20 }}>
        <div>Bookings: {kpis?.bookings}</div>
        <div>PAX: {kpis?.pax}</div>
        <div>Revenue: {kpis?.revenue}</div>
      </div>

      {/* 📊 REVENUE CHART */}
      <h3>Revenue</h3>
      {Object.keys(groupedRevenue).map(year => (
        <div key={year} style={{ color: YEAR_COLOR_MAP[year] || "#000" }}>
          <strong>{year}</strong>
          {groupedRevenue[year].map(m => (
            <div key={m.month}>
              Month {m.month}: {m.revenue}
            </div>
          ))}
        </div>
      ))}

      {/* 📊 YOY TABLE */}
      <h3>Year over Year</h3>
      <table border="1">
        <thead>
          <tr>
            <th>Month</th>
            <th>Current</th>
            <th>Previous</th>
          </tr>
        </thead>
        <tbody>
          {yoy.map((r, i) => (
            <tr key={i}>
              <td>{r.month}</td>
              <td>{r.bookings}</td>
              <td>{r.previousBookings ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🏨 HOTEL TAB */}
      <h3>Hotels</h3>

      {stats === null ? (
        <div>Loading...</div>
      ) : (
        <div>
          <div>Total Hotels: {stats.total_hotels}</div>
          <div>Average Rating: {stats.avg_rating}</div>
        </div>
      )}

      <h4>Ratings</h4>
      <table border="1">
        <thead>
          <tr>
            <th>Hotel</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((r, i) => (
            <tr key={i}>
              <td>{r.hotel_name}</td>
              <td>{r.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}