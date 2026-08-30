'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

export default function OnboardingForm() {
  const supabase = createClient();
  const params = useParams<{ leadId: string }>();
  const [form, setForm] = useState({
    brand_name: '', brand_tone: '', target_audience: '', competitors: '',
    color_palette: '', instagram: '', facebook: '', linkedin: '', website: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const upd = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr('');
    const { error } = await supabase.from('onboarding_responses').insert({
      lead_id: params.leadId,
      brand_name: form.brand_name,
      brand_tone: form.brand_tone,
      target_audience: form.target_audience,
      competitors: form.competitors,
      color_palette: form.color_palette,
      social_handles: {
        instagram: form.instagram, facebook: form.facebook,
        linkedin: form.linkedin, website: form.website,
      },
      raw: form,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="glass max-w-sm text-center p-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-serif text-3xl text-white mb-2">Thanks!</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Your details are in. Our team will reach out on WhatsApp with next steps within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Client onboarding</p>
          <h1 className="font-serif text-4xl mt-2 mb-1 text-cosmic-gradient">Tell us about your brand</h1>
          <p className="text-sm text-[var(--text-secondary)]">Takes ~3 minutes. Only you and our team will see this.</p>
        </div>

        <div className="glass p-5">
          <form onSubmit={submit} className="space-y-4">
            <F label="Brand name" v={form.brand_name} on={upd('brand_name')} />
            <F label="Brand voice / tone (e.g. bold, warm, minimal)" v={form.brand_tone} on={upd('brand_tone')} />
            <F label="Target audience" v={form.target_audience} on={upd('target_audience')} textarea />
            <F label="Top 3 competitors" v={form.competitors} on={upd('competitors')} textarea />
            <F label="Brand colours (hex or names)" v={form.color_palette} on={upd('color_palette')} />
            <F label="Instagram URL" v={form.instagram} on={upd('instagram')} />
            <F label="Facebook URL" v={form.facebook} on={upd('facebook')} />
            <F label="LinkedIn URL" v={form.linkedin} on={upd('linkedin')} />
            <F label="Website" v={form.website} on={upd('website')} />
            {err && <p className="text-xs text-[#FF9AA6]">{err}</p>}
            <button type="submit" disabled={saving}
              className="btn-cosmic w-full h-11 rounded-lg text-sm font-medium tracking-wide">
              {saving ? 'Submitting…' : '🚀  Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function F({ label, v, on, textarea }: { label: string; v: string; on: (e: any) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] block mb-1.5">{label}</label>
      {textarea
        ? <textarea value={v} onChange={on} rows={3}
            className="w-full px-3 py-2 bg-black/25 border border-[var(--border-strong)] rounded-lg text-sm text-white placeholder:text-[var(--text-muted)]" />
        : <input value={v} onChange={on}
            className="w-full h-11 px-3 bg-black/25 border border-[var(--border-strong)] rounded-lg text-sm text-white placeholder:text-[var(--text-muted)]" />}
    </div>
  );
}
