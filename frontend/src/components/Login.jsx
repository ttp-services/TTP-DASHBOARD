import { useState, useEffect } from "react";
import { login } from "../api";

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("ttp_theme") || "gray");

  const isDark = theme === "blue";

  const T = isDark ? {
    pageBg: "#050d1a",
    cardBg: "#0a1628",
    cardBorder: "#0e2040",
    text: "#f8fafc",
    muted: "#94a3b8",
    inputBg: "#050d1a",
    inputBorder: "#0e2040",
    inputText: "#f8fafc",
    accent: "#60a5fa",
    btnBg: "#1d4ed8",
    btnHover: "#2563eb",
    errorBg: "#450a0a",
    errorText: "#fca5a5",
    divider: "#0e2040",
  } : {
    pageBg: "#f0f2f5",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    text: "#1a202c",
    muted: "#718096",
    inputBg: "#f8fafc",
    inputBorder: "#e2e8f0",
    inputText: "#1a202c",
    accent: "#0033cc",
    btnBg: "#0033cc",
    btnHover: "#1a4dd6",
    errorBg: "#fff5f5",
    errorText: "#c53030",
    divider: "#e2e8f0",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { setError("Please enter username and password."); return; }
    setLoading(true); setError("");
    try {
      const data = await login(identifier, password);
      if (data.token) { localStorage.setItem("ttp_token", data.token); onLogin(data.token, data.user); }
      else setError(data.error || "Invalid credentials.");
    } catch { setError("Cannot connect to server. Please try again."); }
    finally { setLoading(false); }
  };

  const toggleTheme = () => {
    const next = isDark ? "gray" : "blue";
    setTheme(next);
    localStorage.setItem("ttp_theme", next);
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.pageBg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative",
    }}>
      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        position: "absolute", top: 20, right: 20,
        background: T.cardBg, border: `1px solid ${T.cardBorder}`,
        borderRadius: 8, padding: "8px 14px", cursor: "pointer",
        color: T.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
      }}>
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
        {isDark ? "Light" : "Dark"}
      </button>

      <div style={{
        background: T.cardBg, border: `1px solid ${T.cardBorder}`,
        borderRadius: 16, padding: "40px 40px 36px",
        width: "100%", maxWidth: 400,
        boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,51,0.12)",
      }}>
        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            background: T.btnBg, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
            boxShadow: `0 4px 16px ${T.btnBg}44`,
          }}>
            <img src="/assets/logo.png" alt="TTP" style={{ height: 38, objectFit: "contain", filter: "brightness(0) invert(1)" }}
              onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
            />
            <span style={{ display: "none", color: "#fff", fontWeight: 800, fontSize: 18 }}>TTP</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>TTP Analytics</div>
          <div style={{ fontSize: 13, color: T.muted }}>Sign in to your account</div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Username or Email
            </label>
            <input
              type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
              placeholder="Enter username" autoComplete="username"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                borderRadius: 8, padding: "11px 14px", fontSize: 14,
                color: T.inputText, outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.inputBorder}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" autoComplete="current-password"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                  borderRadius: 8, padding: "11px 42px 11px 14px", fontSize: 14,
                  color: T.inputText, outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: T.muted, padding: 0, display: "flex", alignItems: "center",
              }}>
                {showPw ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: T.errorBg, border: `1px solid ${T.errorText}33`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              fontSize: 13, color: T.errorText,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width: "100%", background: loading ? T.muted : T.btnBg,
            color: "#ffffff", border: "none", borderRadius: 8,
            padding: "12px", fontSize: 14, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            boxShadow: loading ? "none" : `0 4px 12px ${T.btnBg}44`,
          }}
            onMouseEnter={e => { if (!loading) e.target.style.background = T.btnHover; }}
            onMouseLeave={e => { if (!loading) e.target.style.background = T.btnBg; }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.divider}`, fontSize: 12, color: T.muted }}>
          TTP Services &middot; Secure Analytics Platform
        </div>
      </div>
    </div>
  );
}
