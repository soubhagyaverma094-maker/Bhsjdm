// ============================================================
// app/login/page.tsx
// Brand Boosting Network — Space theme login 🚀 (Pro Max motion)
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
  const [status, setStatus] = useState<'idle' | 'signing-in' | 'launching'>('idle');
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
    // Auth succeeded — play launch animation, then navigate
    setStatus('launching');
    setTimeout(() => router.replace('/dashboard'), 1800);
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-6 py-10 ${status === 'launching' ? 'rocket-launching' : ''}`}>
      {/* Meteor shower — 4 shooting stars on staggered loops */}
      <div className="meteors" aria-hidden="true">
        <div className="meteor" />
        <div className="meteor" />
        <div className="meteor" />
        <div className="meteor" />
      </div>

      <div className="w-full max-w-sm">
        {/* HERO — animated rocket */}
        <div className="flex justify-center mb-6">
          <RocketHero />
        </div>

        <div className="text-center mb-6">
          <h1 className="font-serif text-4xl leading-tight tracking-tight">
            <span className="text-cosmic-gradient">Brand Boosting Network</span>
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.18em] mt-2">
            🚀 Launch your growth · CRM Team login
          </p>
        </div>

        <div className={`glass p-5 transition-opacity duration-500 ${status === 'launching' ? 'opacity-0' : 'opacity-100'}`}>
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
              disabled={status !== 'idle'}
              className="btn-cosmic w-full h-11 rounded-lg text-sm font-medium tracking-wide"
            >
              {status === 'signing-in' ? 'Igniting engines…' :
               status === 'launching'  ? '3 · 2 · 1 · LIFTOFF 🚀' :
                                         '🚀  Launch Dashboard'}
            </button>
          </form>
        </div>

        <p className={`text-[11px] text-[var(--text-muted)] text-center mt-6 transition-opacity duration-500 ${status === 'launching' ? 'opacity-0' : 'opacity-100'}`}>
          Only added team members can sign in.
        </p>
      </div>
    </div>
  );
}

/* ---------- Inline SVG rocket + flame + trail ---------- */
function RocketHero() {
  return (
    <svg width="170" height="220" viewBox="0 0 170 220" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#F5F7FF" />
          <stop offset="55%" stopColor="#B8C1E8" />
          <stop offset="100%" stopColor="#7C5CFF" />
        </linearGradient>
        <linearGradient id="body-shadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#FDE68A" />
          <stop offset="35%" stopColor="#F97316" />
          <stop offset="75%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="window" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0%"  stopColor="#DFF9FD" />
          <stop offset="60%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0891B2" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g className="rocket-float" style={{ filter: 'url(#glow)' }}>
        {/* Exhaust trail — soft glow behind */}
        <ellipse cx="85" cy="200" rx="20" ry="8" fill="url(#flame)" opacity="0.4" />

        {/* Flame */}
        <g className="rocket-flame">
          <path d="M65 150 Q85 215 105 150 Q95 172 85 176 Q75 172 65 150 Z" fill="url(#flame)" />
          <path d="M72 152 Q85 195 98 152 Q92 168 85 170 Q78 168 72 152 Z" fill="#FEF3C7" opacity="0.95" />
          <path d="M78 155 Q85 180 92 155 Q88 165 85 166 Q82 165 78 155 Z" fill="#FFFFFF" opacity="0.85" />
        </g>

        {/* Body */}
        <path d="M85 15
                 C 110 40, 120 90, 115 145
                 L 55 145
                 C 50 90, 60 40, 85 15 Z"
              fill="url(#body)" stroke="#4B5580" strokeWidth="1.5" />
        {/* Right-side shadow for 3D */}
        <path d="M85 15
                 C 110 40, 120 90, 115 145
                 L 90 145
                 L 90 15 Z"
              fill="url(#body-shadow)" opacity="0.9" />

        {/* Window */}
        <circle cx="85" cy="72" r="15" fill="url(#window)" stroke="#0F172A" strokeWidth="2.5" />
        <circle cx="80" cy="68" r="5" fill="rgba(255,255,255,0.85)" />
        <circle cx="88" cy="76" r="2" fill="rgba(255,255,255,0.5)" />

        {/* Racing stripe */}
        <rect x="70" y="100" width="30" height="4" fill="var(--accent-3)" opacity="0.8" />
        <rect x="72" y="108" width="26" height="2" fill="var(--accent-2)" opacity="0.7" />

        {/* Fins */}
        <path d="M55 145 L35 170 L60 155 Z" fill="#7C5CFF" stroke="#4B3FA0" strokeWidth="1" />
        <path d="M115 145 L135 170 L110 155 Z" fill="#F472B6" stroke="#B03A80" strokeWidth="1" />

        {/* Body seam */}
        <line x1="85" y1="30" x2="85" y2="140" stroke="rgba(15,23,42,0.35)" strokeWidth="0.8" />

        {/* Bolts / rivets */}
        <circle cx="70" cy="130" r="1.5" fill="#4B5580" />
        <circle cx="100" cy="130" r="1.5" fill="#4B5580" />
        <circle cx="70" cy="50" r="1.2" fill="#4B5580" />
        <circle cx="100" cy="50" r="1.2" fill="#4B5580" />
      </g>

      {/* Ambient stars around rocket */}
      <g fill="#EAF0FF">
        <circle cx="15"  cy="30"  r="1.4" opacity="0.85" />
        <circle cx="155" cy="45"  r="1.2" opacity="0.7"  />
        <circle cx="145" cy="105" r="1"   opacity="0.6"  />
        <circle cx="20"  cy="100" r="1.2" opacity="0.75" />
        <circle cx="160" cy="180" r="1.4" opacity="0.85" />
        <circle cx="10"  cy="180" r="1"   opacity="0.6"  />
        <circle cx="25"  cy="60"  r="0.8" opacity="0.5"  />
        <circle cx="150" cy="15"  r="0.8" opacity="0.5"  />
      </g>
    </svg>
  );
}
