'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav from '../AppNav';
import { createClient, timeAgo } from '../../lib/supabase';

interface Project {
  id: string;
  name: string;
  status: string;
  monthly_value: number | null;
  start_date: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  onboarding: '#D89B2B',
  active: '#3B6D11',
  paused: '#8A8F96',
  completed: '#4680B8',
  cancelled: '#A32D2D',
};

export default function ProjectsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Project[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, monthly_value, start_date, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); setItems([]); return; }
      setItems((data ?? []) as Project[]);
    })();
  }, [router, supabase]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="px-5 py-4">
        <h2 className="text-sm font-medium">All projects</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Auto-created when a lead is marked <b>won</b>.
        </p>
      </div>
      <main className="px-5 pb-12">
        {items === null && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</p>}
        {err && <p className="text-sm text-[#A32D2D]">Error: {err}</p>}
        {items?.length === 0 && !err && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            No projects yet. Close a deal (leads → set stage to <b>won</b>) and a project will spawn here.
          </p>
        )}
        <ul className="divide-y divide-[var(--border-strong)]">
          {items?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 py-3 hover:bg-[var(--surface-1)] -mx-2 px-2 rounded-md"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: STATUS_COLOR[p.status] || '#8A8F96' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                      {timeAgo(p.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {p.status}
                    {p.monthly_value ? ` · ₹${p.monthly_value.toLocaleString('en-IN')}/mo` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
