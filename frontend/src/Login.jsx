import { useState } from "react";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

export default function Login({ onLogin }) {
  const [id, setId]       = useState("");
  const [pw, setPw]       = useState("");
  const [show, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!id || !pw) { setError("Please enter your username and password."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password: pw }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Invalid credentials."); return; }
      // sessionStorage only — clears when browser/tab closes (security requirement)
      sessionStorage.setItem("ttp_token", d.token);
      sessionStorage.setItem("ttp_user", JSON.stringify(d.user));
      localStorage.removeItem("ttp_token");
      localStorage.removeItem("ttp_user");
      onLogin(d.token, d.user);
    } catch {
      setError("Connection error. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">TTP</div>
          <h1 className="login-title">TTP Analytics</h1>
          <p className="login-sub">TTP Services · Internal Dashboard</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}
          <div className="field-group">
            <label className="field-label">Username or Email</label>
            <input className="field-input" type="text" value={id} onChange={e=>setId(e.target.value)} placeholder="Enter your username" autoComplete="username" autoFocus />
          </div>
          <div className="field-group">
            <label className="field-label">Password</label>
            <div style={{position:"relative"}}>
              <input className="field-input" type={show?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder="Enter your password" autoComplete="current-password" style={{paddingRight:40}} />
              <button type="button" onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer",display:"flex",alignItems:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div className="login-footer">TTP Services Middle East · Internal Use Only</div>
      </div>
    </div>
  );
}
