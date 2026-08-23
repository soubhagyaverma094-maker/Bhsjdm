// ============================================================
// app/login/page.tsx
// Brand Boosting Network CRM — Magic link login for team members
// ============================================================
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Enter a valid email');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl leading-none tracking-tight mb-2">Brand Boosting Network</h1>
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.14em]">CRM · Team login</p>
        </div>

        {status === 'sent' ? (
          <div className="bg-[var(--surface-1)] rounded-xl p-5 text-center">
            <i className="ti ti-mail-check text-3xl text-[#3B6D11] mb-2 inline-block" />
            <p className="text-sm font-medium mb-1">Check your inbox</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Magic link sent to {email}. Open it on this device.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.1em] block mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="you@brandboostingnetwork.com"
                className="w-full h-11 px-3.5 bg-[var(--surface-2)] border-[0.5px] border-[var(--border-strong)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20"
                autoFocus
              />
              {status === 'error' && errorMsg && (
                <p className="text-xs text-[#A32D2D] mt-1.5">{errorMsg}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full h-11 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
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
