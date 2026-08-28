'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '../AppNav';
import { createClient, timeAgo } from '../../lib/supabase';

interface Metrics {
  leads_total: number;
  leads_this_month: number;
  hot: number; warm: number; cold: number; dead: number;
  won: number; lost: number;
  bySource: Record<string, number>;
  byService: Record<string, number>;
  activeProjects: number;
  mrr: number;
  outstandingInvoiceTotal: number;
  paidThisMonth: number;
  closeRate: number;
}

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default function ReportsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const monthStart = startOfMonthISO();

      const [leadsR, projectsR, invoicesR] = await Promise.all([
        supabase.from('leads').select('temperature, stage, source, service_interested, created_at'),
        supabase.from('projects').select('status, monthly_value'),
        supabase.from('invoices').select('status, total, paid_at'),
      ]);

      if (leadsR.error) { setErr(leadsR.error.message); return; }

      const leads = leadsR.data || [];
      const projects = projectsR.data || [];
      const invoices = invoicesR.data || [];

      const bySource: Record<string, number> = {};
      const byService: Record<string, number> = {};
      let hot = 0, warm = 0, cold = 0, dead = 0, won = 0, lost = 0, leadsThisMonth = 0;

      leads.forEach((l: any) => {
        bySource[l.source || 'unknown'] = (bySource[l.source || 'unknown'] || 0) + 1;
        const sv = l.service_interested || 'unknown';
        byService[sv] = (byService[sv] || 0) + 1;
        if (l.temperature === 'hot') hot++;
        else if (l.temperature === 'warm') warm++;
        else if (l.temperature === 'cold') cold++;
        else if (l.temperature === 'dead') dead++;
        if (l.stage === 'won') won++;
        else if (l.stage === 'lost') lost++;
        if (l.created_at >= monthStart) leadsThisMonth++;
      });

      const decided = won + lost;
      const closeRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

      const activeProjects = projects.filter((p: any) => p.status === 'active' || p.status === 'onboarding').length;
      const mrr = projects
        .filter((p: any) => p.status === 'active' || p.status === 'onboarding')
        .reduce((s: number, p: any) => s + (Number(p.monthly_value) || 0), 0);

      const outstandingInvoiceTotal = invoices
        .filter((i: any) => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue')
        .reduce((s: number, i: any) => s + Number(i.total || 0), 0);

      const paidThisMonth = invoices
        .filter((i: any) => i.status === 'paid' && i.paid_at && i.paid_at >= monthStart)
        .reduce((s: number, i: any) => s + Number(i.total || 0), 0);

      setM({
        leads_total: leads.length,
        leads_this_month: leadsThisMonth,
        hot, warm, cold, dead, won, lost,
        bySource, byService,
        activeProjects, mrr,
        outstandingInvoiceTotal, paidThisMonth,
        closeRate,
      });
    })();
  }, [router, supabase]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="px-5 py-4">
        <h2 className="text-sm font-medium">Business snapshot</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">Auto-computed. Refresh any time.</p>
      </div>
      <main className="px-5 pb-12 space-y-6">
        {err && <p className="text-sm text-[#A32D2D]">Error: {err}</p>}
        {!m && !err && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
        {m && (
          <>
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="MRR" value={`₹${m.mrr.toLocaleString('en-IN')}`} sub="active + onboarding projects" />
              <Stat label="Paid this month" value={`₹${m.paidThisMonth.toLocaleString('en-IN')}`} />
              <Stat label="Outstanding" value={`₹${m.outstandingInvoiceTotal.toLocaleString('en-IN')}`} sub="unpaid invoices" />
              <Stat label="Close rate" value={`${m.closeRate}%`} sub={`${m.won} won · ${m.lost} lost`} />
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Leads this month" value={m.leads_this_month.toString()} sub={`${m.leads_total} total`} />
              <Stat label="Hot" value={m.hot.toString()} accent="#D14343" />
              <Stat label="Warm" value={m.warm.toString()} accent="#D89B2B" />
              <Stat label="Cold / dead" value={(m.cold + m.dead).toString()} accent="#8A8F96" />
            </section>

            <Breakdown title="Leads by source" data={m.bySource} />
            <Breakdown title="Leads by service" data={m.byService} />
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="border border-[var(--border-strong)] rounded-lg p-3">
      <div className="flex items-center gap-1.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
      </div>
      <p className="text-lg font-medium mt-1 font-mono">{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center gap-3 text-xs">
            <span className="w-32 truncate">{k.replace(/_/g, ' ')}</span>
            <div className="flex-1 h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--text-primary)]" style={{ width: `${(v / total) * 100}%` }} />
            </div>
            <span className="font-mono w-8 text-right">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
