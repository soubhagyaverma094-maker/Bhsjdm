// ============================================================
// app/login/page.tsx
// Brand Boosting Network — Space theme login 🚀
// ============================================================
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing-in'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrorMsg('Enter a valid email'); return; }
    if (!password) { setErrorMsg('Enter your password'); return; }
    setStatus('signing-in');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) { setStatus('idle'); setErrorMsg(error.message); return; }
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* HERO — big rocket blasting off */}
        <div className="flex justify-center mb-6">
          <RocketHero />
        </div>

        <div className="text-center mb-6">
          <h1 className="font-serif text-4xl leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-[var(--accent-2)] via-[var(--accent)] to-[var(--accent-3)] bg-clip-text text-transparent">
              Brand Boosting Network
            </span>
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.18em] mt-2">
            🚀 Launch your growth · CRM Team login
          </p>
        </div>

        <div className="glass p-5">
          <form onSubmit={signIn} className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.14em] block mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                placeholder="you@brandboostingnetwork.com"
                className="w-full h-11 px-3.5 bg-black/25 border border-[var(--border-strong)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.14em] block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 bg-black/25 border border-[var(--border-strong)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60"
                autoComplete="current-password"
              />
              {errorMsg && <p className="text-xs text-[#FF9AA6] mt-1.5">{errorMsg}</p>}
            </div>
            <button
              type="submit"
              disabled={status === 'signing-in'}
              className="btn-cosmic w-full h-11 rounded-lg text-sm font-medium tracking-wide"
            >
              {status === 'signing-in' ? 'Launching…' : '🚀  Launch Dashboard'}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] text-center mt-6">
          Only added team members can sign in.
        </p>
      </div>
    </div>
  );
}

/* ---------- Inline SVG rocket with animated flame ---------- */
function RocketHero() {
  return (
    <svg width="150" height="180" viewBox="0 0 150 180" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF0FF" />
          <stop offset="60%" stopColor="#A6B0D6" />
          <stop offset="100%" stopColor="#7C5CFF" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="window" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#7BE7F5" />
          <stop offset="100%" stopColor="#22D3EE" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g className="rocket-float" style={{ filter: 'url(#glow)' }}>
        {/* Flame */}
        <g className="rocket-flame">
          <path d="M62 130 Q75 175 88 130 Q80 145 75 148 Q70 145 62 130 Z" fill="url(#flame)" />
          <path d="M68 132 Q75 158 82 132 Q78 140 75 142 Q72 140 68 132 Z" fill="#FFEDD5" opacity="0.9" />
        </g>

        {/* Body */}
        <path d="M75 20
                 C 95 40, 105 75, 100 120
                 L 50 120
                 C 45 75, 55 40, 75 20 Z"
              fill="url(#body)" stroke="#4B5580" strokeWidth="1.2" />

        {/* Window */}
        <circle cx="75" cy="65" r="12" fill="url(#window)" stroke="#0F172A" strokeWidth="2" />
        <circle cx="72" cy="62" r="4" fill="rgba(255,255,255,0.75)" />

        {/* Fins */}
        <path d="M50 120 L35 140 L55 130 Z" fill="#7C5CFF" />
        <path d="M100 120 L115 140 L95 130 Z" fill="#F472B6" />

        {/* Body seam */}
        <line x1="75" y1="35" x2="75" y2="118" stroke="rgba(15,23,42,0.35)" strokeWidth="0.6" />
      </g>

      {/* Little stars around */}
      <g fill="#EAF0FF" opacity="0.85">
        <circle cx="15" cy="30" r="1.4" />
        <circle cx="135" cy="45" r="1.2" />
        <circle cx="125" cy="95" r="1" />
        <circle cx="20" cy="90" r="1.2" />
        <circle cx="140" cy="140" r="1.4" />
        <circle cx="10" cy="150" r="1" />
      </g>
    </svg>
  );
}
