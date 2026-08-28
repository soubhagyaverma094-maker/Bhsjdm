'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '../AppNav';
import { createClient, timeAgo } from '../../lib/supabase';

interface Invoice {
  id: string;
  invoice_no: string;
  lead_id: string;
  total: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_link: string | null;
  created_at: string;
}

interface LeadOption { id: string; label: string; }

const COLOR: Record<string, string> = {
  draft: '#8A8F96',
  sent: '#4680B8',
  partial: '#D89B2B',
  paid: '#3B6D11',
  overdue: '#A32D2D',
  cancelled: '#8A8F96',
};

export default function InvoicesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Invoice[] | null>(null);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');

  // new-invoice form state
  const [leadId, setLeadId] = useState('');
  const [desc, setDesc] = useState('Monthly retainer');
  const [amount, setAmount] = useState('');
  const [gst, setGst] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const [{ data: inv, error }, { data: ld }] = await Promise.all([
        supabase.from('invoices').select('id, invoice_no, lead_id, total, currency, status, due_date, paid_at, payment_link, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('leads').select('id, name, phone, company').order('last_activity_at', { ascending: false }).limit(100),
      ]);
      if (error) { setErr(error.message); setItems([]); return; }
      setItems((inv ?? []) as Invoice[]);
      setLeads((ld ?? []).map((l: any) => ({
        id: l.id,
        label: `${l.name || l.phone}${l.company ? ' · ' + l.company : ''}`,
      })));
    })();
  }, [router, supabase]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) { setErr('Pick a lead'); return; }
    const sub = parseFloat(amount) || 0;
    const g = parseFloat(gst) || 0;
    const { data, error } = await supabase.from('invoices').insert({
      lead_id: leadId,
      line_items: [{ description: desc, quantity: 1, unit_price: sub, total: sub }],
      subtotal: sub,
      gst: g,
      total: sub + g,
      due_date: dueDate || null,
      payment_link: paymentLink.trim() || null,
      status: 'sent',
    }).select('*').single();
    if (error) { setErr(error.message); return; }
    if (data) setItems((prev) => [data as Invoice, ...(prev ?? [])]);
    setShowNew(false); setAmount(''); setGst(''); setDueDate(''); setPaymentLink('');
  }

  async function markPaid(id: string) {
    const { data } = await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), paid_amount: undefined })
      .eq('id', id)
      .select('*').single();
    if (data) setItems((prev) => prev?.map((i) => i.id === id ? (data as Invoice) : i) ?? null);
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Invoices</h2>
        <button onClick={() => setShowNew(!showNew)}
          className="text-xs h-8 px-3 rounded-md bg-[var(--text-primary)] text-[var(--surface-2)]">
          {showNew ? 'Cancel' : '+ New invoice'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="px-5 pb-4 space-y-3 border-b border-[var(--border-strong)]">
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)}
            className="w-full h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm">
            <option value="">— pick lead —</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description"
            className="w-full h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount"
              className="h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
            <input type="number" value={gst} onChange={(e) => setGst(e.target.value)} placeholder="GST"
              className="h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          </div>
          <input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="Payment link (Razorpay / Stripe / UPI) — optional"
            className="w-full h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
          <button type="submit"
            className="h-10 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm">
            Create invoice
          </button>
        </form>
      )}

      <main className="px-5 pb-12">
        {items === null && <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</p>}
        {err && <p className="text-sm text-[#A32D2D]">Error: {err}</p>}
        {items?.length === 0 && !err && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">No invoices yet.</p>
        )}
        <ul className="divide-y divide-[var(--border-strong)]">
          {items?.map((i) => (
            <li key={i.id} className="py-3 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR[i.status] || '#8A8F96' }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium font-mono truncate">{i.invoice_no}</p>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                    {timeAgo(i.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {i.currency} {i.total.toLocaleString('en-IN')} · {i.status}
                  {i.due_date && i.status !== 'paid' ? ` · due ${i.due_date}` : ''}
                </p>
              </div>
              {i.payment_link && i.status !== 'paid' && (
                <a href={i.payment_link} target="_blank" rel="noopener"
                  className="text-[11px] h-7 px-2 rounded-md border border-[var(--border-strong)] shrink-0 flex items-center">
                  Pay link
                </a>
              )}
              {i.status !== 'paid' && i.status !== 'cancelled' && (
                <button onClick={() => markPaid(i.id)}
                  className="text-[11px] h-7 px-2 rounded-md border border-[var(--border-strong)] shrink-0">
                  Mark paid
                </button>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
