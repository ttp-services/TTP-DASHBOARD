import { useState } from "react";

export default function Login({ onLogin }) {
  const [u, setU] = useState(""), [p, setP] = useState(""), [err, setErr] = useState(""), [loading, setLoading] = useState(false), [showPw, setShowPw] = useState(false);
  const API = import.meta.env.VITE_API_URL || "https://ttp-dashboard-api-dpczbed3bvhchxe9.belgiumcentral-01.azurewebsites.net";

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username: u, password: p }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Login failed"); setLoading(false); return; }
      localStorage.setItem("ttp_token", d.token);
      localStorage.setItem("ttp_user", JSON.stringify(d.user));
      onLogin(d.token, d.user);
    } catch { setErr("Cannot connect to server"); setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f1117", fontFamily:"Inter,sans-serif" }}>
      <div style={{ width:380, padding:"40px 36px", background:"#1a1d27", borderRadius:16, border:"1px solid #2a2d3a", boxShadow:"0 24px 48px rgba(0,0,0,0.4)" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <img src="/TTP-DASHBOARD/assets/logo.png" alt="TTP Services" style={{ height:60, objectFit:"contain", marginBottom:12 }}
            onError={e => { e.target.style.display="none"; }} />
          <div style={{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.5px" }}>TTP Analytics</div>
          <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>Data Engine v2.0</div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"#9ca3af", display:"block", marginBottom:6 }}>USERNAME</label>
            <input value={u} onChange={e=>setU(e.target.value)} placeholder="Enter username" autoFocus
              style={{ width:"100%", padding:"11px 14px", background:"#111318", border:"1px solid #2a2d3a", borderRadius:8, color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"#9ca3af", display:"block", marginBottom:6 }}>PASSWORD</label>
            <div style={{ position:"relative" }}>
              <input value={p} onChange={e=>setP(e.target.value)} type={showPw?"text":"password"} placeholder="Enter password"
                style={{ width:"100%", padding:"11px 40px 11px 14px", background:"#111318", border:"1px solid #2a2d3a", borderRadius:8, color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <button type="button" onClick={()=>setShowPw(v=>!v)}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#6b7280", fontSize:16, padding:0, lineHeight:1 }}>
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {err && <div style={{ background:"#2d1b1b", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 }}>{err}</div>}
          <button type="submit" disabled={loading || !u || !p}
            style={{ width:"100%", padding:"12px", background: loading?"#374151":"#3b82f6", color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:700, cursor: loading||!u||!p?"not-allowed":"pointer", transition:"background 0.2s" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop:24, textAlign:"center", fontSize:11, color:"#374151" }}>
          TTP Services · Belgium · <span style={{ color:"#22c55e" }}>●</span> Secured
        </div>
      </div>
    </div>
  );
}
