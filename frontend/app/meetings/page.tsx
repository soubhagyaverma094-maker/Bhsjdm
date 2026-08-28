'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav from '../AppNav';
import { createClient, timeAgo } from '../../lib/supabase';

interface Meeting {
  id: string;
  lead_id: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_type: string;
  status: string;
  meeting_link: string | null;
  ai_summary: string | null;
}

const COLOR: Record<string, string> = {
  scheduled: '#4680B8',
  confirmed: '#3B6D11',
  completed: '#8A8F96',
  no_show: '#A32D2D',
  cancelled: '#8A8F96',
  rescheduled: '#D89B2B',
};

export default function MeetingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Meeting[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data, error } = await supabase
        .from('meetings')
        .select('id, lead_id, scheduled_at, duration_minutes, meeting_type, status, meeting_link, ai_summary')
        .order('scheduled_at', { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); setItems([]); return; }
      setItems((data ?? []) as Meeting[]);
    })();
  }, [router, supabase]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Meetings</h2>
        <Link href="/meetings/new"
          className="text-xs h-8 px-3 rounded-md bg-[var(--text-primary)] text-[var(--surface-2)] flex items-center">
          + Schedule
        </Link>
      </div>
      <main className="px-5 pb-12">
        {items === null && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</p>}
        {err && <p className="text-sm text-[#A32D2D]">Error: {err}</p>}
        {items?.length === 0 && !err && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            No meetings yet. Tap “+ Schedule”.
          </p>
        )}
        <ul className="divide-y divide-[var(--border-strong)]">
          {items?.map((m) => {
            const when = new Date(m.scheduled_at);
            const upcoming = when.getTime() > Date.now();
            return (
              <li key={m.id}>
                <Link href={`/meetings/${m.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-[var(--surface-1)] -mx-2 px-2 rounded-md">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: COLOR[m.status] || '#8A8F96' }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium truncate">
                        {when.toLocaleString('en-IN', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })} · {m.meeting_type}
                      </p>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                        {upcoming ? 'in ' + timeAgo(new Date(Date.now() * 2 - when.getTime()).toISOString()) : timeAgo(m.scheduled_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {m.status} · {m.duration_minutes} min
                      {m.ai_summary && ' · has summary'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
