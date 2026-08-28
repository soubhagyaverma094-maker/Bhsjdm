'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

export default function OnboardingForm() {
  const supabase = createClient();
  const params = useParams<{ leadId: string }>();
  const [form, setForm] = useState({
    brand_name: '',
    brand_tone: '',
    target_audience: '',
    competitors: '',
    color_palette: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    website: '',
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
        instagram: form.instagram,
        facebook: form.facebook,
        linkedin: form.linkedin,
        website: form.website,
      },
      raw: form,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-2xl mb-2">Thanks!</h1>
          <p className="text-sm text-neutral-600">
            Your details are in. Our team will reach out on WhatsApp with next steps within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-6 py-8">
      <div className="max-w-lg mx-auto">
        <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Client onboarding</p>
        <h1 className="font-serif text-3xl mt-2 mb-1">Tell us about your brand</h1>
        <p className="text-sm text-neutral-600 mb-6">Takes ~3 minutes. Only you and our team will see this.</p>

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
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full h-11 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}

function F({ label, v, on, textarea }: { label: string; v: string; on: (e: any) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 block mb-1.5">{label}</label>
      {textarea
        ? <textarea value={v} onChange={on} rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
        : <input value={v} onChange={on}
            className="w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm" />}
    </div>
  );
}
