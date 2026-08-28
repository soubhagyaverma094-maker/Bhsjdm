// ============================================================
// app/login/page.tsx
// Brand Boosting Network CRM — Email + password login
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
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Enter a valid email');
      return;
    }
    if (!password) {
      setErrorMsg('Enter your password');
      return;
    }
    setStatus('signing-in');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setStatus('idle');
      setErrorMsg(error.message);
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl leading-none tracking-tight mb-2">Brand Boosting Network</h1>
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.14em]">CRM · Team login</p>
        </div>

        <form onSubmit={signIn} className="space-y-3">
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.1em] block mb-1.5">
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
              placeholder="you@brandboostingnetwork.com"
              className="w-full h-11 px-3.5 bg-[var(--surface-2)] border-[0.5px] border-[var(--border-strong)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.1em] block mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
              placeholder="••••••••"
              className="w-full h-11 px-3.5 bg-[var(--surface-2)] border-[0.5px] border-[var(--border-strong)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20"
              autoComplete="current-password"
            />
            {errorMsg && <p className="text-xs text-[#A32D2D] mt-1.5">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            disabled={status === 'signing-in'}
            className="w-full h-11 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {status === 'signing-in' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[11px] text-[var(--text-muted)] text-center mt-8">
          Only added team members can sign in.
        </p>
      </div>
    </div>
  );
}
