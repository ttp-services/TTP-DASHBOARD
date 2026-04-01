const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

export async function login(identifier, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Login failed");
  return res.json();
}

function headers() {
  const h = { "Content-Type": "application/json" };
  const key   = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_KEY) || "";
  const token = localStorage.getItem("ttp_token") || sessionStorage.getItem("ttp_token");
  if (key)   h["x-api-key"]     = key;
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === "") return;
    if (Array.isArray(v)) { v.forEach(x => sp.append(k, x)); }
    else sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function get(url, params) {
  const res = await fetch(`${BASE}${url}${qs(params)}`, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const fetchKpis                = (f) => get("/api/dashboard/kpis",               f);
export const fetchYearMonthComparison = (f) => get("/api/dashboard/year-month-comparison", f);
export const fetchRevenueByYear       = (f) => get("/api/dashboard/revenue-by-year",      f);
export const fetchSlicers             = ()  => get("/api/dashboard/slicers");
export const fetchBusOccupancy        = (f) => get("/api/dashboard/bus-occupancy",        f);
export const fetchTransportBreakdown  = (f) => get("/api/dashboard/transport-breakdown",  f);
export const fetchDeparturePlaces     = (f) => get("/api/dashboard/departure-places",     f);
export const fetchBusKpis             = (f) => get("/api/dashboard/bus-kpis",             f);
export const fetchDeckClass           = (f) => get("/api/dashboard/deck-class",           f);
export const fetchBookingsTable       = (f) => get("/api/dashboard/bookings-table",       f);
export const fetchHotelReviews        = (f) => get("/api/dashboard/hotel-reviews",        f);

export async function chatWithAI(message, history = []) {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "AI chat failed");
  return res.json();
}
