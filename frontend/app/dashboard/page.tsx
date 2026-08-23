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
} from '@/lib/supabase';

type FilterKey = 'all' | 'hot' | 'warm' | 'cold' | 'unassigned' | 'mine';

const TEMP_STYLES: Record<Temperature, { border: string; badge: string; text: string }> = {
  hot:  { border: 'border-l-[#E24B4A]', badge: 'bg-[#FAECE7]', text: 'text-[#A32D2D]' },
  warm: { border: 'border-l-[#EF9F27]', badge: 'bg-[#FAEEDA]', text: 'text-[#854F0B]' },
  cold: { border: 'border-l-[#378ADD]', badge: 'bg-[#E6F1FB]', text: 'text-[#185FA5]' },
  dead: { border: 'border-l-neutral-300', badge: 'bg-neutral-100', text: 'text-neutral-500' },
};

const ACTION_ICON: Record<string, string> = {
  call: 'ti-phone',
  meeting: 'ti-calendar',
  proposal: 'ti-file-text',
  message: 'ti-message',
  nurture: 'ti-clock',
  default: 'ti-arrow-right',
};

function inferActionIcon(action: string | null): string {
  if (!action) return ACTION_ICON.default;
  const a = action.toLowerCase();
  if (a.includes('call')) return ACTION_ICON.call;
  if (a.includes('meeting') || a.includes('book') || a.includes('schedule')) return ACTION_ICON.meeting;
  if (a.includes('proposal') || a.includes('quote')) return ACTION_ICON.proposal;
  if (a.includes('nurture') || a.includes('follow-up') || a.includes('wait')) return ACTION_ICON.nurture;
  return ACTION_ICON.message;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [me, setMe] = useState<string | null>(null);
  const [stats, setStats] = useState({ hot: 0, unassigned: 0, wonThisMonth: 0, wonValue: 0 });

  useEffect(() => {
    void loadCurrentMember();
    void loadLeads();
    void loadStats();

    // Realtime subscription — new leads appear instantly
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        void loadLeads();
        void loadStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCurrentMember() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data } = await supabase
      .from('team_members').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (data) setMe(data.id);
  }

  async function loadLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*, team_member:team_members(id, full_name, email, role)')
      .not('stage', 'in', '(won,lost)')
      .order('score', { ascending: false })
      .order('last_activity_at', { ascending: false })
      .limit(100);
    if (!error && data) setLeads(data as Lead[]);
    setLoading(false);
  }

  async function loadStats() {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [{ count: hot }, { count: unassigned }, { data: won }] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('temperature', 'hot').not('stage', 'in', '(won,lost)'),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .is('assigned_to', null).not('stage', 'in', '(won,lost)'),
      supabase.from('leads').select('deal_value')
        .eq('stage', 'won').gte('won_at', monthStart.toISOString()),
    ]);

    const wonValue = (won || []).reduce((sum, l: any) => sum + (l.deal_value || 0), 0);
    setStats({
      hot: hot || 0,
      unassigned: unassigned || 0,
      wonThisMonth: won?.length || 0,
      wonValue,
    });
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      switch (filter) {
        case 'hot':        return l.temperature === 'hot';
        case 'warm':       return l.temperature === 'warm';
        case 'cold':       return l.temperature === 'cold';
        case 'unassigned': return !l.assigned_to;
        case 'mine':       return l.assigned_to === me;
        default:           return true;
      }
    });
  }, [leads, filter, me]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="max-w-2xl mx-auto px-4 pt-6 pb-4 flex items-end justify-between border-b border-[var(--border)]">
        <div>
          <h1 className="font-serif text-3xl leading-none tracking-tight">Brand Boosting Network</h1>
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.14em] mt-1.5">
            Leads · Kiara AI
          </p>
        </div>
        <button
          onClick={() => { void loadLeads(); void loadStats(); }}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Refresh"
        >
          <i className="ti ti-refresh text-lg" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-[var(--surface-1)] rounded-lg p-3.5">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] mb-1.5">
              Hot · action now
            </p>
            <span className="font-serif text-3xl leading-none">{stats.hot}</span>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              {stats.unassigned} unassigned
            </p>
          </div>
          <div className="bg-[var(--surface-1)] rounded-lg p-3.5">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] mb-1.5">
              Won · this month
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-3xl leading-none">
                ₹{(stats.wonValue / 100000).toFixed(1)}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">L</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              {stats.wonThisMonth} deals closed
            </p>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.12em]">
            Action needed
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
          </span>
        </div>

        {/* Lead list */}
        {loading ? (
          <p className="text-center text-[var(--text-muted)] text-sm py-8">Loading leads…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] text-sm py-8">
            No leads in this segment.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-1.5 pt-4 pb-2 overflow-x-auto -mx-4 px-4">
          {(['all', 'hot', 'warm', 'cold', 'unassigned', 'mine'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-[var(--text-primary)] text-[var(--surface-2)] border-[var(--text-primary)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f === 'mine' ? 'Assigned to me' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

// ---------- Lead row card ----------
function LeadRow({ lead }: { lead: Lead }) {
  const style = TEMP_STYLES[lead.temperature];
  const icon = inferActionIcon(lead.ai_recommended_action);

  return (
    <Link
      href={`/leads/${lead.id}`}
      className={`flex bg-[var(--surface-2)] border-[0.5px] border-[var(--border)] ${style.border} border-l-[3px] rounded-r-lg p-3.5 gap-3 hover:border-[var(--border-strong)] transition-colors`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <p className="text-sm font-medium truncate">
            {lead.name || lead.phone}
          </p>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {timeAgo(lead.last_activity_at)}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] truncate mb-2">
          {lead.company || 'No company'} · {formatService(lead.service_interested)} · {formatBudget(lead.budget_range)}
        </p>
        <p className="text-xs text-[var(--text-primary)] leading-snug flex items-start gap-1.5">
          <i className={`ti ${icon} text-sm mt-0.5 text-[var(--text-secondary)] shrink-0`} aria-hidden />
          <span className="line-clamp-2">
            {lead.ai_recommended_action || 'Pending qualification'}
          </span>
        </p>
      </div>
      <div className="flex flex-col items-end justify-between min-w-[44px]">
        <span className="font-serif text-3xl leading-none">{lead.score}</span>
        <span className={`text-[10px] uppercase tracking-[0.1em] font-medium mt-1 ${style.text}`}>
          {lead.temperature}
        </span>
      </div>
    </Link>
  );
}
