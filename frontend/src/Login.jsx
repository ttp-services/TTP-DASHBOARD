import { useState } from "react";

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const TTPLogo = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="8" fill="#1d4ed8"/>
    <text x="18" y="25" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="Georgia, serif">TTP</text>
  </svg>
);

export default function Login({ onLogin, themeKey, onTheme }) {
  const [id, setId]         = useState("");
  const [pw, setPw]         = useState("");
  const [show, setShow]     = useState(false);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState("");

  const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

  const submit = async (e) => {
    e.preventDefault();
    if (!id || !pw) { setError("Please enter your username and password."); return; }
    setLoad(true); setError("");
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id, password: pw }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Invalid credentials. Please try again."); return; }
      localStorage.setItem("ttp_token", d.token);
      localStorage.setItem("ttp_user", JSON.stringify(d.user));
      onLogin(d.token, d.user);
    } catch {
      setError("Connection error. Please check your network and try again.");
    } finally {
      setLoad(false);
    }
  };

  const isDark = themeKey === "dark";

  const T = isDark ? {
    bg: "#0f1115", card: "#1a1d23", border: "#2d333d",
    text: "#f1f5f9", textMuted: "#94a3b8", textDim: "#64748b",
    input: "#0f1115", inputBorder: "#374151", accent: "#3b82f6",
    error: "#f87171", errorBg: "#450a0a",
  } : {
    bg: "#f0f4f8", card: "#ffffff", border: "#e2e8f0",
    text: "#0f172a", textMuted: "#64748b", textDim: "#94a3b8",
    input: "#f8fafc", inputBorder: "#e2e8f0", accent: "#1d4ed8",
    error: "#dc2626", errorBg: "#fef2f2",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: isDark
        ? "radial-gradient(ellipse at 60% 0%, #1e3a5f 0%, #0f1115 60%)"
        : "radial-gradient(ellipse at 60% 0%, #dbeafe 0%, #f0f4f8 60%)",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      padding: "20px",
    }}>
      {/* Theme toggle */}
      <button onClick={onTheme} style={{
        position: "fixed", top: 20, right: 20,
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: "7px 10px", cursor: "pointer",
        color: T.textMuted, display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 500,
      }}>
        {isDark
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        }
        {isDark ? "Light" : "Dark"}
      </button>

      <div style={{
        width: "100%", maxWidth: 400,
        background: T.card, borderRadius: 16,
        border: `1px solid ${T.border}`,
        boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.5)" : "0 24px 80px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "36px 40px 28px",
          borderBottom: `1px solid ${T.border}`,
          background: isDark ? "rgba(30,58,95,0.2)" : "rgba(219,234,254,0.3)",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <TTPLogo size={48} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            TTP Analytics
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            TTP Services — Internal Dashboard
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ padding: "32px 40px 36px" }}>
          {error && (
            <div style={{
              background: T.errorBg, border: `1px solid ${T.error}44`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 20,
              fontSize: 13, color: T.error, display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Username or Email
            </label>
            <input
              type="text" value={id} onChange={e => setId(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username" autoFocus
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 8,
                border: `1px solid ${T.inputBorder}`, background: T.input,
                color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.inputBorder}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "11px 44px 11px 14px", borderRadius: 8,
                  border: `1px solid ${T.inputBorder}`, background: T.input,
                  color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
              <button type="button" onClick={() => setShow(s => !s)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: T.textMuted, display: "flex", alignItems: "center", padding: 4,
              }}>
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 8,
            background: loading ? T.textDim : T.accent,
            border: "none", color: "#fff", fontSize: 14,
            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s", letterSpacing: "0.02em",
          }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          padding: "14px 40px", borderTop: `1px solid ${T.border}`,
          background: isDark ? "rgba(0,0,0,0.2)" : "rgba(248,250,252,0.8)",
          textAlign: "center", fontSize: 12, color: T.textDim,
        }}>
          TTP Services Belgium · Internal Use Only
        </div>
      </div>
    </div>
  );
}
