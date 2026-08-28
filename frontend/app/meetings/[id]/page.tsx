'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppNav from '../../AppNav';
import { createClient } from '../../../lib/supabase';

interface Meeting {
  id: string;
  lead_id: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_type: string;
  status: string;
  meeting_link: string | null;
  ai_summary: string | null;
  ai_next_steps: any;
  transcript: string | null;
  internal_notes: string | null;
}

const STATUSES = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled'];

export default function MeetingDetail() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [m, setM] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data } = await supabase.from('meetings').select('*').eq('id', params.id).maybeSingle();
      if (data) {
        setM(data as Meeting);
        setTranscript((data as any).transcript || '');
        setNotes((data as any).internal_notes || '');
        setStatus((data as any).status || 'scheduled');
      }
    })();
  }, [params.id, router, supabase]);

  async function saveEdits() {
    if (!m) return;
    await supabase.from('meetings').update({
      transcript: transcript || null,
      internal_notes: notes || null,
      status,
    }).eq('id', m.id);
    const { data } = await supabase.from('meetings').select('*').eq('id', m.id).maybeSingle();
    if (data) setM(data as Meeting);
  }

  async function generateSummary() {
    if (!m || !transcript.trim()) { setErr('Paste the transcript first'); return; }
    setSummarizing(true); setErr('');
    // Save transcript first, then hit the summary endpoint
    await supabase.from('meetings').update({ transcript }).eq('id', m.id);
    const r = await fetch(`/api/meetings/${m.id}/summary`, { method: 'POST' });
    setSummarizing(false);
    if (!r.ok) { setErr(await r.text().catch(() => 'Failed')); return; }
    const { data } = await supabase.from('meetings').select('*').eq('id', m.id).maybeSingle();
    if (data) setM(data as Meeting);
  }

  if (!m) return <div className="min-h-screen"><AppNav /><p className="p-6 text-sm text-[var(--text-muted)]">Loading…</p></div>;

  const when = new Date(m.scheduled_at);
  const nextSteps: string[] = Array.isArray(m.ai_next_steps) ? m.ai_next_steps : [];

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        <div>
          <button onClick={() => router.push('/meetings')} className="text-xs text-[var(--text-muted)] mb-2">
            ← All meetings
          </button>
          <h2 className="font-serif text-2xl">
            {when.toLocaleString('en-IN', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {m.meeting_type} · {m.duration_minutes} min
            {m.meeting_link && <> · <a className="underline" href={m.meeting_link} target="_blank">Join link</a></>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="h-8 px-2 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded text-xs">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)] block mb-1.5">
            Transcript
          </label>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={8}
            placeholder="Paste the call transcript here (from Otter, Fireflies, Zoom, etc.)…"
            className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          <div className="flex gap-2 mt-2">
            <button onClick={generateSummary} disabled={summarizing || !transcript.trim()}
              className="h-9 px-3 rounded-md bg-[var(--text-primary)] text-[var(--surface-2)] text-xs disabled:opacity-50">
              {summarizing ? 'Summarising…' : 'AI summarise'}
            </button>
            <button onClick={saveEdits}
              className="h-9 px-3 rounded-md border border-[var(--border-strong)] text-xs">
              Save
            </button>
          </div>
          {err && <p className="text-xs text-[#A32D2D] mt-1">{err}</p>}
        </div>

        {m.ai_summary && (
          <section className="border-t border-[var(--border-strong)] pt-4">
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">AI summary</h3>
            <p className="text-sm whitespace-pre-line">{m.ai_summary}</p>
            {nextSteps.length > 0 && (
              <>
                <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] mt-4 mb-2">
                  Next steps
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
          </section>
        )}

        <div>
          <label className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-secondary)] block mb-1.5">
            Internal notes
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
        </div>
      </main>
    </div>
  );
}
