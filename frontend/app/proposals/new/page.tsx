'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '../../AppNav';
import { createClient } from '../../../lib/supabase';

interface LeadOption { id: string; label: string; }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)
    + '-' + Math.random().toString(36).slice(2, 8);
}

export default function NewProposalPage() {
  const supabase = createClient();
  const router = useRouter();
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [gst, setGst] = useState('');
  const [terms, setTerms] = useState('50% advance, 50% on delivery. Valid 15 days.');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data } = await supabase
        .from('leads')
        .select('id, name, phone, company')
        .order('last_activity_at', { ascending: false })
        .limit(100);
      setLeads((data ?? []).map((l: any) => ({
        id: l.id,
        label: `${l.name || l.phone}${l.company ? ' · ' + l.company : ''}`,
      })));
    })();
  }, [router, supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) { setErr('Pick a lead'); return; }
    if (!title.trim()) { setErr('Add a title'); return; }
    const subtotal = parseFloat(total) || 0;
    const gstAmt = parseFloat(gst) || 0;
    const slug = slugify(title);
    setSaving(true); setErr('');
    const { data, error } = await supabase.from('proposals').insert({
      lead_id: leadId,
      title: title.trim(),
      subtotal,
      gst: gstAmt,
      total: subtotal + gstAmt,
      terms,
      public_slug: slug,
      status: 'draft',
    }).select('id').single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.replace('/proposals');
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-lg mx-auto px-5 py-6">
        <h2 className="font-serif text-2xl mb-4">New proposal</h2>
        <form onSubmit={save} className="space-y-4">
          <Field label="Lead">
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm"
            >
              <option value="">— pick a lead —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Social media retainer — 3 months"
              className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subtotal (₹)">
              <input type="number" value={total} onChange={(e) => setTotal(e.target.value)}
                placeholder="50000"
                className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
            </Field>
            <Field label="GST (₹)">
              <input type="number" value={gst} onChange={(e) => setGst(e.target.value)}
                placeholder="9000"
                className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
            </Field>
          </div>
          <Field label="Terms">
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3}
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          </Field>
          {err && <p className="text-xs text-[#A32D2D]">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="h-11 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Create draft'}
            </button>
            <button type="button" onClick={() => router.back()}
              className="h-11 px-4 rounded-lg border border-[var(--border-strong)] text-sm">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.1em] block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
