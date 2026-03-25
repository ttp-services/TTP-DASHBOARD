import { useState } from "react";
import { login } from "../api";

const LIGHT = { bg:"#f4f5f7",card:"#ffffff",border:"#e5e7eb",accent:"#1d4ed8",text:"#111827",muted:"#6b7280",inputBg:"#f9fafb",inputBorder:"#e5e7eb",errorBg:"#fef2f2",errorText:"#dc2626",errorBorder:"#fecaca" };
const DARK  = { bg:"#0f1115",card:"#1a1d23",border:"#2d333d",accent:"#3b82f6",text:"#f8fafc",muted:"#8b95a1",inputBg:"#0f1115",inputBorder:"#2d333d",errorBg:"#450a0a",errorText:"#ef4444",errorBorder:"#7f1d1d" };

export default function Login({ onLogin, themeKey="light", onTheme }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const T = themeKey === "dark" ? DARK : LIGHT;
  const isDark = themeKey === "dark";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { setError("Please enter your username and password."); return; }
    setLoading(true); setError("");
    try {
      const data = await login(identifier, password);
      if (data.token) { localStorage.setItem("ttp_token", data.token); onLogin(data.token, data.user); }
      else setError(data.error || "Invalid credentials. Please try again.");
    } catch { setError("Cannot connect to server. Please check your connection."); }
    finally { setLoading(false); }
  };

  const inp = { width:"100%", boxSizing:"border-box", background:T.inputBg, border:`1px solid ${T.inputBorder}`, borderRadius:8, padding:"10px 14px", fontSize:14, color:T.text, outline:"none", transition:"border-color 0.15s", colorScheme:isDark?"dark":"light" };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif", position:"relative" }}>
      {/* Dot pattern */}
      <div style={{ position:"fixed",inset:0,zIndex:0,backgroundImage:`radial-gradient(circle at 1px 1px, ${isDark?"#2d333d":"#e5e7eb"} 1px, transparent 0)`,backgroundSize:"28px 28px",opacity:0.5 }}/>

      {/* Theme toggle */}
      {onTheme&&<button onClick={()=>onTheme(isDark?"light":"dark")} style={{ position:"absolute",top:20,right:20,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 13px",cursor:"pointer",color:T.muted,fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:5,zIndex:10 }}>
        {isDark?(
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        ):(
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
        {isDark?"Light":"Dark"} mode
      </button>}

      <div style={{ position:"relative",zIndex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"38px 38px 34px",width:"100%",maxWidth:400,boxShadow:isDark?"0 4px 24px rgba(0,0,0,0.6)":"0 4px 24px rgba(0,0,0,0.08)" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <div style={{ width:58,height:58,borderRadius:14,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:`0 4px 16px ${T.accent}44` }}>
            <img src="/assets/logo.png" alt="TTP" style={{ height:34,objectFit:"contain",filter:"brightness(0) invert(1)" }}
              onError={e=>{ e.target.style.display="none"; e.target.nextSibling.style.display="block"; }}/>
            <span style={{ display:"none",color:"#fff",fontWeight:800,fontSize:15 }}>TTP</span>
          </div>
          <div style={{ fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.02em",marginBottom:4 }}>TTP Analytics</div>
          <div style={{ fontSize:13,color:T.muted }}>Sign in to your account</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:13 }}>
            <label style={{ display:"block",fontSize:11,fontWeight:700,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em" }}>Username or Email</label>
            <input type="text" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Enter your username" autoComplete="username" style={inp}
              onFocus={e=>{e.target.style.borderColor=T.accent;if(!isDark)e.target.style.background="#fff";}}
              onBlur={e=>{e.target.style.borderColor=T.inputBorder;e.target.style.background=T.inputBg;}}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block",fontSize:11,fontWeight:700,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"
                style={{ ...inp,paddingRight:42 }}
                onFocus={e=>{e.target.style.borderColor=T.accent;if(!isDark)e.target.style.background="#fff";}}
                onBlur={e=>{e.target.style.borderColor=T.inputBorder;e.target.style.background=T.inputBg;}}/>
              <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.muted,padding:0,display:"flex",alignItems:"center" }}>
                {showPw?(
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ):(
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {error&&<div style={{ background:T.errorBg,border:`1px solid ${T.errorBorder}`,borderRadius:8,padding:"9px 13px",marginBottom:14,fontSize:13,color:T.errorText }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ width:"100%",background:loading?T.muted:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",transition:"background 0.15s",boxShadow:loading?"none":`0 2px 8px ${T.accent}44` }}
            onMouseEnter={e=>{ if(!loading) e.target.style.background=isDark?"#2563eb":"#1e40af"; }}
            onMouseLeave={e=>{ if(!loading) e.target.style.background=T.accent; }}>
            {loading?"Signing in...":"Sign In"}
          </button>
        </form>

        <div style={{ textAlign:"center",marginTop:24,paddingTop:18,borderTop:`1px solid ${isDark?"#2d333d":"#f3f4f6"}`,fontSize:12,color:T.muted }}>
          TTP Services &middot; Secure Analytics Platform
        </div>
      </div>
    </div>
  );
}
