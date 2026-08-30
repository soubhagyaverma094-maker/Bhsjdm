// Public website lead capture form — anyone can submit.
// Creates a lead with source='website' → triggers the same downstream
// qualification / assignment / follow-up flow as WhatsApp.
'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase';

const SERVICES = [
  'social_media',
  'video_production',
  'branding',
  'website',
  'paid_ads',
  'seo',
  'other',
];
const BUDGETS = [
  { v: 'under_10k', l: 'Under ₹10k / month' },
  { v: '10k_25k', l: '₹10-25k / month' },
  { v: '25k_50k', l: '₹25-50k / month' },
  { v: '50k_1L', l: '₹50k-1L / month' },
  { v: '1L_3L', l: '₹1-3L / month' },
  { v: '3L_plus', l: '₹3L+ / month' },
];

export default function LeadFormPage() {
  const supabase = createClient();
  const [f, setF] = useState({
    name: '', phone: '', email: '', company: '',
    service: '', budget: '', message: '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [err, setErr] = useState('');

  const upd = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || !f.phone.trim()) { setErr('Name and phone are required'); return; }
    setStatus('saving'); setErr('');
    const { error } = await supabase.from('leads').insert({
      name: f.name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim() || null,
      company: f.company.trim() || null,
      source: 'website_form',
      service_interested: f.service || null,
      budget_range: f.budget || null,
      qualification_data: { initial_message: f.message.trim() },
    });
    if (error) { setStatus('idle'); setErr(error.message); return; }
    setStatus('done');
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-3xl mb-2">Thank you</h1>
          <p className="text-sm text-neutral-600">
            Your enquiry is in. Our team will reach out on WhatsApp within a few hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-6 py-10">
      <div className="max-w-lg mx-auto">
        <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Brand Boosting Network</p>
        <h1 className="font-serif text-3xl mt-2 mb-1">Start a project</h1>
        <p className="text-sm text-neutral-600 mb-6">
          Fill this and we’ll reach out on WhatsApp within a few hours with next steps.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <F label="Name" v={f.name} on={upd('name')} required />
          <F label="WhatsApp number" v={f.phone} on={upd('phone')} required type="tel" placeholder="+91…" />
          <F label="Email" v={f.email} on={upd('email')} type="email" />
          <F label="Company / brand" v={f.company} on={upd('company')} />

          <div>
            <L>Service you need</L>
            <select value={f.service} onChange={upd('service')}
              className="w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm bg-white">
              <option value="">— choose —</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <L>Monthly budget</L>
            <select value={f.budget} onChange={upd('budget')}
              className="w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm bg-white">
              <option value="">— choose —</option>
              {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
            </select>
          </div>

          <div>
            <L>Tell us more (optional)</L>
            <textarea value={f.message} onChange={upd('message')} rows={4}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="submit" disabled={status === 'saving'}
            className="w-full h-11 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-50">
            {status === 'saving' ? 'Sending…' : 'Send enquiry'}
          </button>
        </form>

        <p className="text-[11px] text-neutral-400 mt-8 text-center">
          By submitting you agree to be contacted about your enquiry.
        </p>
      </div>
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 block mb-1.5">{children}</label>;
}
function F({ label, v, on, required, type = 'text', placeholder }: {
  label: string; v: string; on: (e: any) => void;
  required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <L>{label}{required && ' *'}</L>
      <input type={type} value={v} onChange={on} placeholder={placeholder} required={required}
        className="w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm" />
    </div>
  );
}
