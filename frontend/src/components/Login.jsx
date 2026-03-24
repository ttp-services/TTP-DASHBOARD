import { useState } from "react";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

const THEMES = {
  gray: { bg: "#f3f4f6", card: "#ffffff", border: "#e5e7eb", accent: "#0033cc", text: "#111827", muted: "#6b7280", inputBg: "#ffffff", error: "#dc2626", errorBg: "#fef2f2" },
  dark: { bg: "#0d1117", card: "#161b22", border: "#30363d", accent: "#58a6ff", text: "#e6edf3", muted: "#8b949e", inputBg: "#21262d", error: "#f85149", errorBg: "#2d1215" },
};

export default function Login({ onLogin, themeName = "gray", setThemeName }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const T = THEMES[themeName] || THEMES.gray;

  const handleSubmit = async () => {
    if (!identifier || !password) { setError("Please enter your username and password."); return; }
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Login failed. Please check your credentials."); return; }
      onLogin(d.token, d.user);
    } catch {
      setError("Cannot connect to server. Please make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.text, padding: "11px 14px", fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>

      {/* Theme toggle */}
      {setThemeName && (
        <button onClick={() => setThemeName(t => t === "gray" ? "dark" : "gray")}
          style={{ position: "absolute", top: 20, right: 20, background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: "8px 14px", fontSize: 12, color: T.muted, cursor: "pointer", fontWeight: 600 }}>
          {themeName === "gray" ? "🌙 Dark" : "☀️ Light"}
        </button>
      )}

      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
        {/* Card */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "40px 36px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <img src="/assets/logo.png" alt="TTP" style={{ height: 52, objectFit: "contain" }}
                onError={e => {
                  e.target.style.display = "none";
                  const fallback = e.target.nextSibling;
                  if (fallback) fallback.style.display = "flex";
                }} />
              <div style={{ display: "none", width: 52, height: 52, background: T.accent, borderRadius: 12,
                alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 20 }}>TTP</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>TTP Analytics</div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Sign in to your dashboard</div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: T.errorBg, border: `1px solid ${T.error}`, borderRadius: 8,
              padding: "10px 14px", fontSize: 13, color: T.error, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.muted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Username or Email</label>
              <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="username or email" style={inputStyle}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.muted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="your password" style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = T.accent}
                  onBlur={e => e.target.style.borderColor = T.border} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}>
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading}
              style={{ width: "100%", background: loading ? T.muted : T.accent, color: "#fff", border: "none",
                borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, transition: "all 0.2s", letterSpacing: "0.02em" }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: T.muted }}>
          TTP Services &nbsp;·&nbsp; Secure Analytics Platform
        </div>
      </div>
    </div>
  );
}
