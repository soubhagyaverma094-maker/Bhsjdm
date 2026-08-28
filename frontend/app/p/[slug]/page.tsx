// Public proposal viewer — no auth required.
// Server component: fetches by public_slug + tracks view.
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

interface Params { params: Promise<{ slug: string }>; }

async function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function PublicProposal({ params }: Params) {
  const { slug } = await params;
  const supabase = await getServerSupabase();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, services, subtotal, gst, total, currency, terms, validity_days, status, sent_at, view_count')
    .eq('public_slug', slug)
    .maybeSingle();

  if (!proposal) notFound();

  // Fire-and-forget view tracking (only if not draft — draft = internal preview)
  if (proposal.status !== 'draft') {
    try { await headers(); } catch {}
    await supabase
      .from('proposals')
      .update({
        view_count: (proposal.view_count || 0) + 1,
        first_viewed_at: proposal.status === 'sent' ? new Date().toISOString() : undefined,
        last_viewed_at: new Date().toISOString(),
        status: proposal.status === 'sent' ? 'viewed' : proposal.status,
      })
      .eq('public_slug', slug);
  }

  const services: any[] = Array.isArray(proposal.services) ? proposal.services : [];

  return (
    <div className="min-h-screen bg-white text-neutral-900 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Proposal</p>
        <h1 className="font-serif text-3xl mt-2">{proposal.title}</h1>

        {services.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium mb-3">Scope</h2>
            <ul className="space-y-3">
              {services.map((s, i) => (
                <li key={i} className="border-b pb-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{s.name || '—'}</span>
                    <span className="font-mono">
                      {proposal.currency} {(s.monthly_price || s.one_time_price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {s.description && <p className="text-xs text-neutral-600 mt-1">{s.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 border-t pt-6">
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" val={`${proposal.currency} ${(proposal.subtotal || 0).toLocaleString('en-IN')}`} />
            {proposal.gst ? <Row label="GST" val={`${proposal.currency} ${proposal.gst.toLocaleString('en-IN')}`} /> : null}
            <Row label="Total" val={`${proposal.currency} ${(proposal.total || 0).toLocaleString('en-IN')}`} strong />
          </div>
        </section>

        {proposal.terms && (
          <section className="mt-8">
            <h2 className="text-sm font-medium mb-2">Terms</h2>
            <p className="text-xs text-neutral-600 whitespace-pre-line">{proposal.terms}</p>
          </section>
        )}

        <p className="text-[11px] text-neutral-400 mt-10 text-center">
          Valid for {proposal.validity_days} days from date of issue.
        </p>
      </div>
    </div>
  );
}

function Row({ label, val, strong }: { label: string; val: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-medium text-base pt-2' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">{val}</span>
    </div>
  );
}
