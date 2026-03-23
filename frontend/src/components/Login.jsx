import { useState } from "react";
import { login } from "../api";

const THEMES = {
  gray: {
    bg: "#f4f5f7",
    card: "#ffffff",
    border: "#e2e5ea",
    accent: "#0033cc",
    text: "#1a1d23",
    muted: "#6b7280",
    inputBg: "#f9fafb",
  },
  dark: {
    bg: "#050d1a",
    card: "#0a1628",
    border: "#0e2040",
    accent: "#60a5fa",
    text: "#f8fafc",
    muted: "#94a3b8",
    inputBg: "#070e1c",
  },
};

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem("ttp_theme") || "gray"
  );
  const T = THEMES[themeKey] || THEMES.gray;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(identifier, password);
      localStorage.setItem("ttp_theme", themeKey);
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const EyeOpen = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const EyeOff = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      position: "relative",
    }}>
      {/* Theme toggle top right */}
      <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 8 }}>
        {[["gray", "Light"], ["dark", "Dark"]].map(([k, l]) => (
          <button key={k} onClick={() => { setThemeKey(k); localStorage.setItem("ttp_theme", k); }}
            style={{
              background: themeKey === k ? T.accent : "transparent",
              border: `1px solid ${themeKey === k ? T.accent : T.border}`,
              borderRadius: 6, color: themeKey === k ? "#fff" : T.muted,
              padding: "4px 12px", fontSize: 11, cursor: "pointer", fontWeight: themeKey === k ? 600 : 400,
            }}>{l}</button>
        ))}
      </div>

      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: "44px 40px",
        width: 380,
        boxShadow: themeKey === "gray"
          ? "0 4px 24px rgba(0,0,0,0.08)"
          : "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src="/assets/logo.png"
            alt="TTP"
            style={{
              height: 44,
              objectFit: "contain",
              marginBottom: 12,
              filter: themeKey === "dark" ? "brightness(0) invert(1)" : "none",
            }}
          />
          <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Analytics Platform
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              Username or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Enter username or email"
              autoFocus
              style={{
                width: "100%", background: T.inputBg,
                border: `1px solid ${T.border}`, borderRadius: 8,
                color: T.text, padding: "10px 14px", fontSize: 13,
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: "100%", background: T.inputBg,
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  color: T.text, padding: "10px 44px 10px 14px", fontSize: 13,
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none",
                  cursor: "pointer", color: T.muted,
                  padding: 0, display: "flex", alignItems: "center",
                }}
              >
                {showPw ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, padding: "10px 14px",
              color: "#dc2626", fontSize: 12, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !identifier || !password}
            style={{
              width: "100%",
              background: loading || !identifier || !password ? "#94a3b8" : "#0033cc",
              border: "none", borderRadius: 8,
              color: "#ffffff",
              padding: "12px", fontWeight: 700, fontSize: 14,
              cursor: loading || !identifier || !password ? "default" : "pointer",
              transition: "all 0.2s", letterSpacing: "0.02em",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: T.muted }}>
          TTP Services &middot; Secure Analytics Platform
        </div>
      </div>
    </div>
  );
}
