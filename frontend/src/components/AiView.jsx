import { useState, useRef, useEffect } from "react";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return new Intl.NumberFormat("nl-BE").format(Math.round(v));
}

function fmtEuro(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `€${(v / 1_000).toFixed(1)}K`;
  return `€${fmtNum(v)}`;
}

const SUGGESTED = [
  "What were total bookings for 2026 vs 2025?",
  "Show me revenue by dataset",
  "What is the cancellation rate?",
  "Which month had the most PAX?",
  "Compare Solmar vs Snowtravel this year",
  "What is the average revenue per booking?",
];

export default function AiView({ user, kpiData }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm TTP AI — your analytics assistant for TTP Services.\n\nI have direct access to the live Azure SQL database. I'll always verify data before answering, and if your question is ambiguous I'll ask you to clarify rather than guess.\n\nWhat would you like to know?",
      ts: new Date(),
    }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const endRef                = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setError("");

    const userMsg = { role: "user", content: msg, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = localStorage.getItem("ttp_token") || sessionStorage.getItem("ttp_token") || user?.token;
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg, history }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || "No response received.",
        source: data.source,
        ts: new Date(),
      }]);
    } catch (e) {
      setError(e.message);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I encountered an error connecting to the database. Please try again or check your connection.",
        isError: true,
        ts: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const fmtTime = (d) => {
    if (!d) return "";
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  };

  return (
    <div className="ai-view">
      {/* Context bar */}
      {kpiData && (
        <div className="ai-context-bar">
          <div className="ai-context-item">
            <span className="ai-ctx-label">Live DB</span>
            <span className="ai-ctx-val ai-ctx-live">● Connected</span>
          </div>
          <div className="ai-context-item">
            <span className="ai-ctx-label">2026 Bookings</span>
            <span className="ai-ctx-val">{fmtNum(kpiData.currentBookings)}</span>
          </div>
          <div className="ai-context-item">
            <span className="ai-ctx-label">2026 Revenue</span>
            <span className="ai-ctx-val">{fmtEuro(kpiData.currentRevenue)}</span>
          </div>
          <div className="ai-context-item">
            <span className="ai-ctx-label">2026 PAX</span>
            <span className="ai-ctx-val">{fmtNum(kpiData.currentPax)}</span>
          </div>
          <div className="ai-context-item ai-ctx-note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            AI will ask for clarification if unsure
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role} ${m.isError ? "error" : ""}`}>
            <div className="ai-msg-avatar">
              {m.role === "assistant" ? "✦" : (user?.name || "U")[0].toUpperCase()}
            </div>
            <div className="ai-msg-body">
              <div className="ai-msg-header">
                <span className="ai-msg-author">
                  {m.role === "assistant" ? "TTP AI" : (user?.name || "You")}
                </span>
                {m.source && (
                  <span className={`ai-source-badge ${m.source}`}>
                    {m.source === "openai" ? "GPT-4o" : "fallback"}
                  </span>
                )}
                <span className="ai-msg-time">{fmtTime(m.ts)}</span>
              </div>
              <div className="ai-msg-content">
                {m.content.split("\n").map((line, j) => (
                  <p key={j} className={line.startsWith("•") ? "ai-bullet" : ""}>
                    {line || "\u00A0"}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-msg assistant">
            <div className="ai-msg-avatar">✦</div>
            <div className="ai-msg-body">
              <div className="ai-msg-header">
                <span className="ai-msg-author">TTP AI</span>
              </div>
              <div className="ai-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggested prompts (show when only welcome message) */}
      {messages.length === 1 && (
        <div className="ai-suggestions">
          <p className="ai-suggestions-label">Try asking:</p>
          <div className="ai-suggestions-grid">
            {SUGGESTED.map((s, i) => (
              <button key={i} className="ai-suggestion-btn" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="ai-input-area">
        {error && (
          <div className="ai-error-bar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            </svg>
            {error}
          </div>
        )}
        <div className="ai-input-row">
          <textarea
            ref={inputRef}
            className="ai-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about bookings, revenue, PAX, trends… (Enter to send)"
            rows={1}
            disabled={loading}
          />
          <button
            className={`ai-send-btn ${loading ? "loading" : ""}`}
            onClick={() => send()}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </circle>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
        <p className="ai-disclaimer">
          TTP AI queries live Azure SQL data. Always validate critical numbers in the dashboard before acting on them.
        </p>
      </div>
    </div>
  );
}
