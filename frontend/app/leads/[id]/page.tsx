// ============================================================
// app/leads/[id]/page.tsx
// Brand Boosting Network CRM — Lead detail view
// ============================================================
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  createClient, timeAgo, formatBudget, formatService, initials,
  type Lead, type WhatsAppMessage, type LeadActivity,
} from '@/lib/supabase';

const ACTIVITY_ICON: Record<string, string> = {
  lead_created: 'ti-user-plus',
  qualification_started: 'ti-message-circle',
  qualification_completed: 'ti-message-circle',
  score_updated: 'ti-chart-bar',
  assigned: 'ti-user-check',
  reassigned: 'ti-user-check',
  message_sent: 'ti-brand-whatsapp',
  message_received: 'ti-brand-whatsapp',
  follow_up_scheduled: 'ti-bell',
  follow_up_sent: 'ti-send',
  meeting_scheduled: 'ti-calendar',
  meeting_completed: 'ti-calendar-check',
  proposal_sent: 'ti-file-text',
  proposal_viewed: 'ti-eye',
  stage_changed: 'ti-arrow-right',
  deal_won: 'ti-trophy',
  deal_lost: 'ti-x',
  human_handoff: 'ti-user',
  note_added: 'ti-note',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAll();

    // Realtime: new messages appear as they come in
    const channel = supabase
      .channel(`lead-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `lead_id=eq.${id}` },
        () => void loadMessages()
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_activities', filter: `lead_id=eq.${id}` },
        () => void loadActivities()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadAll() {
    await Promise.all([loadLead(), loadMessages(), loadActivities()]);
    setLoading(false);
  }
  async function loadLead() {
    const { data } = await supabase
      .from('leads')
      .select('*, team_member:team_members(*)')
      .eq('id', id).single();
    if (data) setLead(data as Lead);
  }
  async function loadMessages() {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*').eq('lead_id', id)
      .order('created_at', { ascending: true }).limit(30);
    if (data) setMessages(data as WhatsAppMessage[]);
  }
  async function loadActivities() {
    const { data } = await supabase
      .from('lead_activities')
      .select('*').eq('lead_id', id)
      .order('created_at', { ascending: false }).limit(20);
    if (data) setActivities(data as LeadActivity[]);
  }

  async function rescoreLead() {
    await fetch(`/api/leads/${id}/score`, {
      method: 'POST',
      headers: { 'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_TRIGGER_KEY! },
    });
    setTimeout(loadAll, 1500);
  }

  async function markWon() {
    const value = prompt('Deal value (₹)?');
    if (!value) return;
    await supabase.from('leads').update({
      stage: 'won',
      deal_value: parseFloat(value),
      won_at: new Date().toISOString(),
    }).eq('id', id);
    await supabase.from('lead_activities').insert({
      lead_id: id, activity_type: 'deal_won', actor_type: 'team_member',
      content: `Deal won at ₹${parseFloat(value).toLocaleString('en-IN')}`,
    });
    router.push('/dashboard');
  }

  if (loading) return <p className="text-center text-[var(--text-muted)] text-sm py-16">Loading lead…</p>;
  if (!lead) return <p className="text-center text-[var(--text-muted)] text-sm py-16">Lead not found</p>;

  const breakdown = (lead.qualification_data?.breakdown || {}) as Record<string, number>;
  const rubric = [
    { key: 'budget_fit',        label: 'Budget',     max: 30 },
    { key: 'urgency',           label: 'Urgency',    max: 25 },
    { key: 'service_clarity',   label: 'Clarity',    max: 20 },
    { key: 'decision_authority',label: 'Authority',  max: 15 },
    { key: 'engagement_quality',label: 'Engagement', max: 10 },
  ];

  const tempColors = {
    hot: { bg: 'bg-[#FAECE7]', text: 'text-[#A32D2D]', accentBg: 'bg-[#FAECE7]', accentIcon: 'text-[#993C1D]', accentLabel: 'text-[#712B13]', accentTxt: 'text-[#4A1B0C]' },
    warm:{ bg: 'bg-[#FAEEDA]', text: 'text-[#854F0B]', accentBg: 'bg-[#FAEEDA]', accentIcon: 'text-[#854F0B]', accentLabel: 'text-[#633806]', accentTxt: 'text-[#412402]' },
    cold:{ bg: 'bg-[#E6F1FB]', text: 'text-[#185FA5]', accentBg: 'bg-[#E6F1FB]', accentIcon: 'text-[#185FA5]', accentLabel: 'text-[#0C447C]', accentTxt: 'text-[#042C53]' },
    dead:{ bg: 'bg-neutral-100', text: 'text-neutral-500', accentBg: 'bg-neutral-100', accentIcon: 'text-neutral-500', accentLabel: 'text-neutral-600', accentTxt: 'text-neutral-700' },
  }[lead.temperature];

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* Nav */}
      <div className="flex items-center gap-2.5 pb-3">
        <Link href="/dashboard" className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Back">
          <i className="ti ti-arrow-left text-lg" />
        </Link>
        <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.12em]">
          Leads · {lead.temperature}
        </span>
      </div>

      {/* Hero */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border)] mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-medium leading-tight mb-0.5">{lead.name || lead.phone}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            {[lead.company, lead.role_title, lead.city].filter(Boolean).join(' · ') || 'No company info'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium uppercase tracking-[0.08em] ${tempColors.bg} ${tempColors.text}`}>
              {lead.temperature}
            </span>
            {lead.service_interested && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-1)] text-[var(--text-secondary)]">
                {formatService(lead.service_interested)}
              </span>
            )}
            {lead.budget_range && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-1)] text-[var(--text-secondary)]">
                {formatBudget(lead.budget_range)}
              </span>
            )}
          </div>
        </div>
        {lead.team_member && (
          <div
            className="w-9 h-9 rounded-full bg-[var(--surface-1)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)] shrink-0"
            title={`Assigned to ${lead.team_member.full_name}`}
          >
            {initials(lead.team_member.full_name)}
          </div>
        )}
      </div>

      {/* Score block */}
      <div className="grid grid-cols-[auto,1fr] gap-4 items-center bg-[var(--surface-1)] rounded-xl p-4 mb-4">
        <div className="flex items-baseline">
          <span className="font-serif text-5xl leading-none">{lead.score}</span>
          <span className="font-serif text-lg text-[var(--text-muted)]">/100</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {rubric.map((r) => {
            const val = breakdown[r.key] ?? 0;
            const pct = (val / r.max) * 100;
            return (
              <div key={r.key} className="grid grid-cols-[60px,1fr,22px] gap-2 items-center text-[10px]">
                <span className="text-[var(--text-secondary)] uppercase tracking-[0.06em]">{r.label}</span>
                <div className="h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--text-primary)] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[var(--text-muted)] font-mono text-right">{val}/{r.max}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI reasoning */}
      {lead.ai_reasoning && (
        <blockquote className="border-l-2 border-[var(--border-strong)] pl-3 py-1 mb-4">
          <p className="font-serif text-base leading-relaxed italic text-[var(--text-primary)]">
            {lead.ai_reasoning}
          </p>
          <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.1em] mt-1.5 block">
            Kiara · AI analysis
          </span>
        </blockquote>
      )}

      {/* Recommended action */}
      {lead.ai_recommended_action && (
        <div className={`${tempColors.accentBg} rounded-xl p-3.5 mb-5 flex items-start gap-2.5`}>
          <i className={`ti ti-target text-xl ${tempColors.accentIcon} shrink-0 mt-0.5`} aria-hidden />
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] uppercase tracking-[0.1em] font-medium mb-1 ${tempColors.accentLabel}`}>
              Next action
            </p>
            <p className={`text-[13px] leading-snug ${tempColors.accentTxt}`}>
              {lead.ai_recommended_action}
            </p>
          </div>
        </div>
      )}

      {/* Conversation */}
      {messages.length > 0 && (
        <>
          <SectionHeader label="WhatsApp conversation" meta={`${messages.length} messages`} />
          <div className="bg-[var(--surface-1)] rounded-xl p-3 mb-5 flex flex-col gap-2">
            {messages.slice(-8).map((m) => (
              <div key={m.id} className="flex flex-col">
                <div
                  className={`max-w-[82%] px-3 py-2 text-[13px] leading-snug rounded-2xl ${
                    m.direction === 'inbound'
                      ? 'msg-in self-start rounded-bl-sm'
                      : 'msg-out self-end rounded-br-sm'
                  }`}
                >
                  {m.content}
                </div>
                <span className={`text-[10px] text-[var(--text-muted)] mt-0.5 ${
                  m.direction === 'inbound' ? 'self-start ml-3' : 'self-end mr-3'
                }`}>
                  {m.direction === 'inbound' ? (lead.name || 'Client') : (m.sent_by === 'bot' ? 'Kiara' : 'You')} · {timeAgo(m.created_at)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Activity */}
      {activities.length > 0 && (
        <>
          <SectionHeader label="Activity" />
          <div className="flex flex-col gap-2.5 mb-6 px-0.5">
            {activities.slice(0, 8).map((a) => (
              <div key={a.id} className="grid grid-cols-[20px,1fr,auto] gap-2.5 items-baseline text-xs">
                <i className={`ti ${ACTIVITY_ICON[a.activity_type] || 'ti-point'} text-sm text-[var(--text-muted)]`} aria-hidden />
                <span className="text-[var(--text-primary)] leading-snug">
                  {a.content}
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.06em] ml-1.5">
                    {a.actor_type === 'ai' ? 'AI' : a.actor_type === 'system' ? 'System' : ''}
                  </span>
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono whitespace-nowrap">
                  {timeAgo(a.created_at)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 sticky bottom-0 bg-[var(--bg)] py-3 -mx-4 px-4 border-t border-[var(--border)]">
        <button
          onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank')}
          className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm font-medium hover:opacity-90"
        >
          <i className="ti ti-brand-whatsapp text-base" /> Reply on WhatsApp
        </button>
        <button onClick={() => alert('Meeting booking flow — Phase 2')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-[0.5px] border-[var(--border-strong)] text-sm font-medium hover:bg-[var(--surface-1)]">
          <i className="ti ti-calendar-event text-base" /> Book meeting
        </button>
        <button onClick={rescoreLead}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-[0.5px] border-[var(--border-strong)] text-sm font-medium hover:bg-[var(--surface-1)]">
          <i className="ti ti-refresh text-base" /> Re-score
        </button>
        <button onClick={markWon}
          className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-[#173404] hover:bg-[#EAF3DE]">
          <i className="ti ti-trophy text-base" /> Mark deal won
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.12em]">{label}</span>
      {meta && <span className="text-[11px] text-[var(--text-muted)]">{meta}</span>}
    </div>
  );
}
