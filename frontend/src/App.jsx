import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';

const BASE = "https://ttp-dashboard-api-dpczbed3bvhchxe9.belgiumcentral-01.azurewebsites.net";

const App = () => {
  // --- STATE MANAGEMENT ---
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMetric, setViewMetric] = useState('pax'); // 'pax' or 'bookings'
  const [dataset, setDataset] = useState('Solmar'); // 'Solmar' or 'Snowtravel'
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // --- SECURE DATA FETCH ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${BASE}/api/dashboard/year-month`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.status === 401) {
        console.error("Session Expired");
        return;
      }
      const json = await res.json();
      // Ensure Descending Order: Dec 2026 -> Jan 2023
      const sorted = json.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
      });
      setData(sorted);
    } catch (err) {
      console.error("Connection Error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- CSV EXPORT LOGIC ---
  const downloadCSV = () => {
    const headers = ["Year", "Month", "Bookings", "PAX", "Revenue"];
    const rows = data.map(d => [d.year, d.month, d.bookings, d.pax, d.revenue]);
    const content = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TTP_Data_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // --- UI COMPONENTS ---
  const SidebarItem = ({ id, label, icon }) => (
    <button 
      onClick={() => setTab(id)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all ${
        tab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:bg-gray-800/50'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#0f1115] text-slate-200 font-sans">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 border-r border-gray-800/50 p-6 flex flex-col">
        <div className="mb-10 px-2">
          <h1 className="text-xl font-bold text-white tracking-tight">TTP <span className="text-blue-500">ANALYTICS</span></h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Data Engine v2.0</p>
        </div>
        
        <nav className="flex-1">
          <SidebarItem id="overview" label="Overview" icon="📊" />
          <SidebarItem id="occupancy" label="Bus Occupancy" icon="🚌" />
          <SidebarItem id="datatable" label="Data Table" icon="📅" />
          <SidebarItem id="ai" label="TTP AI" icon="✨" />
        </nav>

        <div className="pt-6 border-t border-gray-800/50">
          <SidebarItem id="settings" label="Settings" icon="⚙️" />
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="w-full text-left p-3 text-red-400 text-sm hover:bg-red-900/10 rounded-xl mt-2"
          >
            🔒 Logout Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-blue-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-sm font-mono tracking-widest">ESTABLISHING SECURE AZURE CONNECTION...</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* TAB: OVERVIEW */}
            {tab === 'overview' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <header className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white">Executive Overview</h2>
                    <p className="text-gray-500">Performance metrics for 2023 - 2026</p>
                  </div>
                  <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                    <button onClick={() => setViewMetric('pax')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${viewMetric === 'pax' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>PAX</button>
                    <button onClick={() => setViewMetric('bookings')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${viewMetric === 'bookings' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>BOOKINGS</button>
                  </div>
                </header>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {[
                    { label: 'Total Bookings', val: data.reduce((a,b)=>a+b.bookings,0).toLocaleString(), color: 'text-blue-400' },
                    { label: 'Total PAX', val: data.reduce((a,b)=>a+b.pax,0).toLocaleString(), color: 'text-emerald-400' },
                    { label: 'Revenue', val: `€${data.reduce((a,b)=>a+b.revenue,0).toLocaleString()}`, color: 'text-white' }
                  ].map((kpi, i) => (
                    <div key={i} className="bg-[#1a1d23] p-6 rounded-2xl border border-gray-800/50">
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</p>
                      <p className={`text-3xl font-bold mt-2 ${kpi.color}`}>{kpi.val}</p>
                    </div>
                  ))}
                </div>

                {/* CHARTS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-[#1a1d23] p-6 rounded-2xl border border-gray-800/50 h-80">
                    <h3 className="text-sm font-bold mb-6 text-gray-400">Revenue Trend (Yearly)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d333d" vertical={false} />
                        <XAxis dataKey="year" stroke="#4b5563" fontSize={10} />
                        <YAxis stroke="#4b5563" fontSize={10} />
                        <Tooltip contentStyle={{backgroundColor:'#1a1d23', border:'none', borderRadius:'8px'}} />
                        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-[#1a1d23] p-6 rounded-2xl border border-gray-800/50 h-80">
                    <h3 className="text-sm font-bold mb-6 text-gray-400">{viewMetric.toUpperCase()} Distribution</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d333d" vertical={false} />
                        <XAxis dataKey="year" stroke="#4b5563" fontSize={10} />
                        <YAxis stroke="#4b5563" fontSize={10} />
                        <Tooltip cursor={{fill: '#2d333d'}} contentStyle={{backgroundColor:'#1a1d23', border:'none', borderRadius:'8px'}} />
                        <Bar dataKey={viewMetric} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BUS OCCUPANCY */}
            {tab === 'occupancy' && (
              <div className="animate-in fade-in duration-500">
                <header className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold text-white">Bus Occupancy</h2>
                  <div className="flex gap-2">
                    {['Solmar', 'Snowtravel'].map(ds => (
                      <button 
                        key={ds}
                        onClick={() => setDataset(ds)}
                        className={`px-6 py-2 rounded-xl text-xs font-bold border transition-all ${
                          dataset === ds ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600'
                        }`}
                      >
                        {ds.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="bg-[#1a1d23] rounded-2xl border border-gray-800/50 overflow-hidden shadow-2xl">
                   <table className="w-full text-left text-sm">
                    <thead className="bg-[#1e222a] text-gray-400 uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="p-5 border-b border-gray-800">Period</th>
                        <th className="p-5 border-b border-gray-800 text-blue-400">RC</th>
                        <th className="p-5 border-b border-gray-800 text-blue-400">FC</th>
                        <th className="p-5 border-b border-gray-800 text-blue-400">PRE</th>
                        <th className="p-5 border-b border-gray-800">Outbound</th>
                        <th className="p-5 border-b border-gray-800">Return</th>
                        <th className="p-5 border-b border-gray-800 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {data.map((row, idx) => {
                        const diff = row.pax - (row.bookings * 1.8); // Example calculation
                        return (
                          <tr key={idx} className="hover:bg-white/[0.02] transition">
                            <td className="p-5 font-medium text-white">{row.month}-{row.year}</td>
                            <td className="p-5 text-gray-400">24</td>
                            <td className="p-5 text-gray-400">12</td>
                            <td className="p-5 text-gray-400">8</td>
                            <td className="p-5 text-white">{row.pax}</td>
                            <td className="p-5 text-white">{Math.floor(row.pax * 0.9)}</td>
                            <td className={`p-5 text-right font-mono font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {diff >= 0 ? `+${Math.floor(diff)}` : Math.floor(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: DATA TABLE */}
            {tab === 'datatable' && (
              <div className="animate-in fade-in duration-500">
                <header className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold text-white">Data Export</h2>
                  <button 
                    onClick={downloadCSV}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40"
                  >
                    📥 Export CSV
                  </button>
                </header>

                <div className="bg-[#1a1d23] p-4 rounded-2xl border border-gray-800/50 mb-6 flex gap-4">
                  <input 
                    type="text" 
                    placeholder="Search Bookings..." 
                    className="bg-[#0f1115] border border-gray-800 rounded-lg px-4 py-2 flex-1 text-sm focus:outline-none focus:border-blue-500"
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <select 
                    className="bg-[#0f1115] border border-gray-800 rounded-lg px-4 py-2 text-sm"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Status</option>
                    <option value="OK">OK</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="bg-[#1a1d23] rounded-2xl border border-gray-800/50 p-8 text-center text-gray-500">
                  <p>Displaying {data.length} records ready for slicing.</p>
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
};

export default App;