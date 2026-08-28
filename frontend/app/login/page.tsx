// ============================================================
// app/login/page.tsx
// Brand Boosting Network CRM — Email + 6-digit OTP login
// ============================================================
'use client';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'verifying'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Enter a valid email');
      return;
    }
    setStatus('sending');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setStatus('idle');
    if (error) { setErrorMsg(error.message); return; }
    setStep('code');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length !== 6) {
      setErrorMsg('Enter the 6-digit code from your email');
      return;
    }
    setStatus('verifying');
    setErrorMsg('');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
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

        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3">
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
              {errorMsg && <p className="text-xs text-[#A32D2D] mt-1.5">{errorMsg}</p>}
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full h-11 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending code…' : 'Send login code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.1em] block mb-1.5">
                6-digit code sent to {email}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrorMsg(''); }}
                placeholder="123456"
                className="w-full h-11 px-3.5 bg-[var(--surface-2)] border-[0.5px] border-[var(--border-strong)] rounded-lg text-lg tracking-[0.4em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20"
                autoFocus
              />
              {errorMsg && <p className="text-xs text-[#A32D2D] mt-1.5">{errorMsg}</p>}
            </div>
            <button
              type="submit"
              disabled={status === 'verifying'}
              className="w-full h-11 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {status === 'verifying' ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setErrorMsg(''); }}
              className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="text-[11px] text-[var(--text-muted)] text-center mt-8">
          Only added team members can sign in.
        </p>
      </div>
    </div>
  );
}
