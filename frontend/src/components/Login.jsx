import { useState } from "react";
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";
export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { setError("Please enter your username and password."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const d = await r.json();
      if (d.token) { localStorage.setItem("ttp_token", d.token); onLogin(d.token, d.user); }
      else setError(d.error || "Invalid credentials. Please try again.");
    } catch { setError("Unable to connect. Check your network connection."); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#eef2ff 0%,#e8ecf4 60%,#f4f5f7 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ position:"fixed", inset:0, opacity:0.025, backgroundImage:"radial-gradient(circle at 1px 1px,#0033cc 1px,transparent 0)", backgroundSize:"28px 28px", pointerEvents:"none" }}/>
      <div style={{ background:"#ffffff", borderRadius:20, padding:"48px 44px 40px", width:"100%", maxWidth:420, boxShadow:"0 4px 6px -1px rgba(0,0,0,0.07),0 20px 60px -8px rgba(0,51,204,0.1)", border:"1px solid #e8ecf4", position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:68, height:68, background:"linear-gradient(135deg,#0033cc 0%,#1a4dd6 100%)", borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", boxShadow:"0 8px 24px rgba(0,51,204,0.25)" }}>
            <img src="/assets/logo.png" alt="TTP" style={{ height:40, objectFit:"contain", filter:"brightness(0) invert(1)" }} onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="block";}}/>
            <svg style={{display:"none"}} width="34" height="34" viewBox="0 0 34 34" fill="none"><path d="M5 9h24M5 17h14M5 25h18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700, color:"#0f172a", letterSpacing:"-0.3px" }}>TTP Analytics</h1>
          <p style={{ margin:"6px 0 0", fontSize:14, color:"#64748b" }}>Sign in to your dashboard</p>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:7 }}>Username or Email</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"#9ca3af", display:"flex" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <input type="text" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Enter username or email" autoComplete="username"
                style={{ width:"100%", boxSizing:"border-box", paddingLeft:40, paddingRight:14, paddingTop:11, paddingBottom:11, background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:10, fontSize:14, color:"#0f172a", outline:"none", transition:"all 0.15s" }}
                onFocus={e=>{e.target.style.borderColor="#0033cc";e.target.style.boxShadow="0 0 0 3px rgba(0,51,204,0.08)";e.target.style.background="#fff";}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";e.target.style.background="#f8fafc";}}/>
            </div>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:7 }}>Password</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"#9ca3af", display:"flex" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password"
                style={{ width:"100%", boxSizing:"border-box", paddingLeft:40, paddingRight:44, paddingTop:11, paddingBottom:11, background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:10, fontSize:14, color:"#0f172a", outline:"none", transition:"all 0.15s" }}
                onFocus={e=>{e.target.style.borderColor="#0033cc";e.target.style.boxShadow="0 0 0 3px rgba(0,51,204,0.08)";e.target.style.background="#fff";}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";e.target.style.background="#f8fafc";}}/>
              <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:0, display:"flex" }} onMouseEnter={e=>e.currentTarget.style.color="#0033cc"} onMouseLeave={e=>e.currentTarget.style.color="#9ca3af"}>
                {showPw
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
          </div>
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", marginBottom:18, fontSize:13, color:"#dc2626", display:"flex", alignItems:"center", gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}
          </div>}
          <button type="submit" disabled={loading} style={{ width:"100%", padding:"12px", background:loading?"#94a3b8":"linear-gradient(135deg,#0033cc 0%,#1a4dd6 100%)", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:loading?"not-allowed":"pointer", boxShadow:loading?"none":"0 4px 14px rgba(0,51,204,0.3)", transition:"all 0.2s" }}
            onMouseEnter={e=>{if(!loading){e.target.style.transform="translateY(-1px)";e.target.style.boxShadow="0 6px 20px rgba(0,51,204,0.4)";}}}
            onMouseLeave={e=>{e.target.style.transform="";e.target.style.boxShadow=loading?"none":"0 4px 14px rgba(0,51,204,0.3)";}}>
            {loading?"Signing in...":"Sign In"}
          </button>
        </form>
        <p style={{ textAlign:"center", marginTop:28, fontSize:12, color:"#94a3b8" }}>TTP Services &nbsp;&middot;&nbsp; Secure Analytics Platform</p>
      </div>
    </div>
  );
}
