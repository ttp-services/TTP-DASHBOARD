import { useState } from "react";

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const API = import.meta.env.VITE_API_URL || "https://ttp-dashboard-api-dpczbed3bvhchxe9.belgiumcentral-01.azurewebsites.net";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: u.trim(), password: p }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Invalid credentials"); setLoading(false); return; }
      localStorage.setItem("ttp_token", d.token);
      localStorage.setItem("ttp_user", JSON.stringify(d.user));
      onLogin(d.token, d.user);
    } catch {
      setErr("Cannot connect to server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f1117", fontFamily:"Inter, system-ui, sans-serif" }}>
      <div style={{ width:400, padding:"44px 40px", background:"#16192a", borderRadius:18, border:"1px solid #252840", boxShadow:"0 32px 64px rgba(0,0,0,0.5)" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:72, height:72, background:"#fff", borderRadius:14, display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:14, overflow:"hidden" }}>
            <img src="/TTP-DASHBOARD/assets/logo.png" alt="TTP" style={{ height:52, objectFit:"contain" }} onError={e=>{e.target.style.display="none";}} />
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:"#fff", letterSpacing:"-0.5px" }}>TTP Analytics</div>
          <div style={{ fontSize:12, color:"#4b5563", marginTop:4 }}>Data Engine v2.0</div>
        </div>

        <form onSubmit={submit} autoComplete="on">
          {/* Username */}
          <div style={{ marginBottom:18 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", display:"block", marginBottom:7, letterSpacing:"0.06em", textTransform:"uppercase" }}>Username</label>
            <input
              value={u} onChange={e=>setU(e.target.value)}
              placeholder="Enter your username"
              autoFocus autoComplete="username"
              style={{ width:"100%", padding:"12px 14px", background:"#0d0f1a", border:"1px solid #252840", borderRadius:10, color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }}
              onFocus={e=>e.target.style.borderColor="#3b82f6"}
              onBlur={e=>e.target.style.borderColor="#252840"}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom:22 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", display:"block", marginBottom:7, letterSpacing:"0.06em", textTransform:"uppercase" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input
                value={p} onChange={e=>setP(e.target.value)}
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ width:"100%", padding:"12px 44px 12px 14px", background:"#0d0f1a", border:"1px solid #252840", borderRadius:10, color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }}
                onFocus={e=>e.target.style.borderColor="#3b82f6"}
                onBlur={e=>e.target.style.borderColor="#252840"}
              />
              <button
                type="button"
                onClick={()=>setShowPw(v=>!v)}
                style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color: showPw ? "#3b82f6" : "#4b5563", padding:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"color 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.color="#3b82f6"}
                onMouseLeave={e=>e.currentTarget.style.color=showPw?"#3b82f6":"#4b5563"}
              >
                {showPw ? <EyeOffIcon/> : <EyeIcon/>}
              </button>
            </div>
          </div>

          {/* Error */}
          {err && (
            <div style={{ background:"rgba(127,29,29,0.4)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:10, padding:"11px 14px", color:"#fca5a5", fontSize:13, marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !u || !p}
            style={{ width:"100%", padding:"13px", background: !u||!p||loading ? "#1e2b4a" : "#3b82f6", color: !u||!p||loading ? "#4b5563" : "#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor: !u||!p||loading ? "not-allowed" : "pointer", transition:"all 0.2s", letterSpacing:"0.02em" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop:28, textAlign:"center", fontSize:11, color:"#374151" }}>
          TTP Services &nbsp;·&nbsp; Belgium &nbsp;·&nbsp; <span style={{ color:"#22c55e" }}>●</span> Secured
        </div>
      </div>
    </div>
  );
}
