import { useState } from 'react';
import { login } from '../api';

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(identifier, password);
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const EyeOpen = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const EyeOff = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  const inputStyle = {
    width: '100%',
    background: '#0a1628',
    border: '1px solid #0e2040',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '11px 14px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050d1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#0a1628',
        border: '1px solid #0e2040',
        borderRadius: 16,
        padding: '48px 44px',
        width: 380,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(56,189,248,0.3)',
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>TTP</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            TTP Analytics
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
            Sign in to your dashboard
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              fontSize: 11, color: '#64748b', textTransform: 'uppercase',
              letterSpacing: '0.07em', display: 'block', marginBottom: 7, fontWeight: 600,
            }}>
              Username or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Enter username or email"
              autoFocus
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#38bdf8'}
              onBlur={e => e.target.style.borderColor = '#0e2040'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label style={{
              fontSize: 11, color: '#64748b', textTransform: 'uppercase',
              letterSpacing: '0.07em', display: 'block', marginBottom: 7, fontWeight: 600,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{ ...inputStyle, paddingRight: 46 }}
                onFocus={e => e.target.style.borderColor = '#38bdf8'}
                onBlur={e => e.target.style.borderColor = '#0e2040'}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 13, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: '#475569',
                  padding: 0, lineHeight: 1,
                  display: 'flex', alignItems: 'center',
                }}
                title={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8, padding: '10px 14px',
              color: '#f87171', fontSize: 13, marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !identifier || !password}
            style={{
              width: '100%',
              background: loading || !identifier || !password
                ? '#0e2040' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
              border: 'none', borderRadius: 10,
              color: loading || !identifier || !password ? '#475569' : '#fff',
              padding: '13px', fontWeight: 700, fontSize: 14,
              cursor: loading || !identifier || !password ? 'default' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#1e3a5f' }}>
          <a href="https://www.ttp-services.com" target="_blank" rel="noreferrer"
            style={{ color: '#334155', textDecoration: 'none' }}>
            TTP Services · Secure Analytics Platform
          </a>
        </div>
      </div>
    </div>
  );
}
