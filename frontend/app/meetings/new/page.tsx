'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppNav from '../../AppNav';
import { createClient } from '../../../lib/supabase';

export default function NewMeetingPage() {
  const supabase = createClient();
  const router = useRouter();
  const search = useSearchParams();
  const [leads, setLeads] = useState<{ id: string; label: string }[]>([]);
  const [leadId, setLeadId] = useState(search?.get('lead') || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('30');
  const [type, setType] = useState('discovery');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data } = await supabase.from('leads')
        .select('id, name, phone, company')
        .order('last_activity_at', { ascending: false }).limit(100);
      setLeads((data ?? []).map((l: any) => ({
        id: l.id,
        label: `${l.name || l.phone}${l.company ? ' · ' + l.company : ''}`,
      })));
    })();
  }, [router, supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId || !scheduledAt) { setErr('Lead and time are required'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('meetings').insert({
      lead_id: leadId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: parseInt(duration, 10),
      meeting_type: type,
      meeting_link: link || null,
      status: 'scheduled',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.replace('/meetings');
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-lg mx-auto px-5 py-6">
        <h2 className="font-serif text-2xl mb-4">Schedule meeting</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <L>Lead</L>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)}
              className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm">
              <option value="">— pick lead —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <L>Date & time</L>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <L>Duration (min)</L>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
            </div>
            <div>
              <L>Type</L>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm">
                <option value="discovery">Discovery</option>
                <option value="demo">Demo</option>
                <option value="proposal_review">Proposal review</option>
                <option value="negotiation">Negotiation</option>
                <option value="onboarding">Onboarding</option>
              </select>
            </div>
          </div>
          <div>
            <L>Meeting link (Zoom / Meet / Cal.com)</L>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…"
              className="w-full h-11 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          </div>
          {err && <p className="text-xs text-[#A32D2D]">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="h-11 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Schedule'}
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

function L({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.1em] block mb-1.5">{children}</label>;
}
