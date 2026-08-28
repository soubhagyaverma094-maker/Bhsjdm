// ============================================================
// app/dashboard/page.tsx
// Brand Boosting Network CRM — Main dashboard (leads action list)
// ============================================================
'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createClient, timeAgo, formatBudget, formatService,
  type Lead, type Temperature,
} from '../../lib/supabase';
import AppNav from '../AppNav';

type Filter = 'all' | Temperature;

const TEMP_ORDER: Temperature[] = ['hot', 'warm', 'cold', 'dead'];
const TEMP_DOT: Record<Temperature, string> = {
  hot: '#D14343',
  warm: '#D89B2B',
  cold: '#4680B8',
  dead: '#8A8F96',
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [email, setEmail] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        router.replace('/login');
        return;
      }
      if (!cancelled) setEmail(userData.user.email ?? '');

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('last_activity_at', { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (error) {
        setErrorMsg(error.message);
        setLeads([]);
        return;
      }
      setLeads((data ?? []) as Lead[]);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, hot: 0, warm: 0, cold: 0, dead: 0 };
    (leads ?? []).forEach((l) => { c.all++; c[l.temperature]++; });
    return c;
  }, [leads]);

  const shown = useMemo(() => {
    if (!leads) return [];
    if (filter === 'all') return leads;
    return leads.filter((l) => l.temperature === filter);
  }, [leads, filter]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen">
      <AppNav />

      <div className="px-5 py-4 flex gap-2 overflow-x-auto">
        {(['all', ...TEMP_ORDER] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3 rounded-full text-xs whitespace-nowrap border ${
              filter === f
                ? 'bg-[var(--text-primary)] text-[var(--surface-2)] border-[var(--text-primary)]'
                : 'border-[var(--border-strong)] text-[var(--text-secondary)]'
            }`}
          >
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            <span className="ml-1.5 opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <main className="px-5 pb-12">
        {leads === null && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading leads…</p>
        )}
        {errorMsg && (
          <p className="text-sm text-[#A32D2D] py-4">Couldn’t load leads: {errorMsg}</p>
        )}
        {leads !== null && shown.length === 0 && !errorMsg && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            {counts.all === 0
              ? 'No leads yet. Once WhatsApp starts feeding in, they’ll show up here.'
              : 'No leads match this filter.'}
          </p>
        )}

        <ul className="divide-y divide-[var(--border-strong)]">
          {shown.map((l) => (
            <li key={l.id}>
              <Link
                href={`/leads/${l.id}`}
                className="flex items-center gap-3 py-3 hover:bg-[var(--surface-1)] -mx-2 px-2 rounded-md"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: TEMP_DOT[l.temperature] }}
                  aria-label={l.temperature}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium truncate">
                      {l.name || l.phone}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                      {timeAgo(l.last_activity_at)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {formatService(l.service_interested)} · {formatBudget(l.budget_range)}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0 w-8 text-right">
                  {l.score}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
