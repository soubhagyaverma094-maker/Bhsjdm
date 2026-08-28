'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav from '../AppNav';
import { createClient, timeAgo } from '../../lib/supabase';

interface Proposal {
  id: string;
  lead_id: string;
  title: string;
  total: number | null;
  currency: string;
  status: string;
  public_slug: string | null;
  view_count: number;
  first_viewed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#8A8F96',
  sent: '#4680B8',
  viewed: '#D89B2B',
  accepted: '#3B6D11',
  rejected: '#A32D2D',
  expired: '#8A8F96',
};

export default function ProposalsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data, error } = await supabase
        .from('proposals')
        .select('id, lead_id, title, total, currency, status, public_slug, view_count, first_viewed_at, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); setItems([]); return; }
      setItems((data ?? []) as Proposal[]);
    })();
  }, [router, supabase]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">All proposals</h2>
        <Link
          href="/proposals/new"
          className="text-xs h-8 px-3 rounded-md bg-[var(--text-primary)] text-[var(--surface-2)] flex items-center"
        >
          + New proposal
        </Link>
      </div>
      <main className="px-5 pb-12">
        {items === null && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</p>}
        {err && <p className="text-sm text-[#A32D2D]">Error: {err}</p>}
        {items?.length === 0 && !err && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            No proposals yet. Tap “New proposal” to create one.
          </p>
        )}
        <ul className="divide-y divide-[var(--border-strong)]">
          {items?.map((p) => (
            <li key={p.id} className="py-3 flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: STATUS_COLOR[p.status] || '#8A8F96' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                    {timeAgo(p.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {p.currency} {p.total?.toLocaleString('en-IN') ?? '—'} · {p.status}
                  {p.view_count > 0 && ` · ${p.view_count} view${p.view_count > 1 ? 's' : ''}`}
                </p>
              </div>
              {p.public_slug && (
                <Link
                  href={`/p/${p.public_slug}`}
                  target="_blank"
                  className="text-[11px] px-2 h-7 rounded-md border border-[var(--border-strong)] flex items-center shrink-0"
                >
                  Open link
                </Link>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
