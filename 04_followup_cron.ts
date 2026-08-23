// ============================================================
// /app/api/cron/follow-ups/route.ts
// Brand Boosting Network — Follow-up Cron (runs every 15 min via Vercel Cron)
// ============================================================
// Vercel cron config in vercel.json:
// { "crons": [{ "path": "/api/cron/follow-ups", "schedule": "*/15 * * * *" }] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // Vercel cron auth
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch pending follow-ups due now
    const now = new Date().toISOString();
    const { data: pending, error } = await supabase
      .from('follow_up_schedule')
      .select('*, leads(*)')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(50); // batch size

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // 2. Load all templates once
    const { data: templates } = await supabase
      .from('message_templates')
      .select('template_key, body')
      .eq('is_active', true);
    const templateMap: Record<string, string> = {};
    (templates || []).forEach((t: any) => (templateMap[t.template_key] = t.body));

    // 3. Load settings
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // 4. Process each
    for (const followUp of pending) {
      const lead = followUp.leads;
      if (!lead) {
        await markStatus(followUp.id, 'skipped', 'Lead not found');
        skipped++;
        continue;
      }

      // Skip if lead has replied recently (they're engaged, don't spam)
      if (lead.last_message_at) {
        const hoursSinceMsg =
          (Date.now() - new Date(lead.last_message_at).getTime()) / (1000 * 60 * 60);
        // If they replied in last 2 hours, skip this follow-up
        if (hoursSinceMsg < 2) {
          await markStatus(followUp.id, 'skipped', 'Client active recently');
          skipped++;
          continue;
        }
      }

      // Skip if deal already won/lost
      if (['won', 'lost'].includes(lead.stage)) {
        await markStatus(followUp.id, 'skipped', `Deal ${lead.stage}`);
        skipped++;
        continue;
      }

      // Skip if bot handed off + no template for this stage
      const template = templateMap[followUp.template_key];
      if (!template) {
        await markStatus(followUp.id, 'skipped', `Template missing: ${followUp.template_key}`);
        skipped++;
        continue;
      }

      // Respect business hours
      const nowTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      });
      const hour = parseInt(nowTime.split(' ')[1]?.split(':')[0] || '12');
      if (hour < 10 || hour >= 20) {
        // Outside 10am-8pm IST — postpone to 10am next open day
        const nextMorning = new Date();
        nextMorning.setHours(10, 0, 0, 0);
        if (hour >= 20) nextMorning.setDate(nextMorning.getDate() + 1);
        await supabase
          .from('follow_up_schedule')
          .update({ scheduled_at: nextMorning.toISOString() })
          .eq('id', followUp.id);
        skipped++;
        continue;
      }

      // Render template with variables
      const rendered = renderTemplate(template, {
        name: lead.name || 'ji',
        service: lead.service_interested || 'marketing',
        meeting_link: settings?.meeting_link_default || '',
        portfolio_link: settings?.agency_website || '',
        case_study_link: `${settings?.agency_website || ''}/work`,
      });

      // Send via WhatsApp
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send-internal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY!,
          },
          body: JSON.stringify({ to: lead.phone, text: rendered, lead_id: lead.id }),
        });

        if (!res.ok) throw new Error(`WA send failed: ${res.status}`);

        await markStatus(followUp.id, 'sent');

        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          activity_type: 'follow_up_sent',
          actor_type: 'system',
          content: `Follow-up sent (${followUp.template_key})`,
          metadata: { sequence_step: followUp.sequence_step, template: followUp.template_key },
        });

        sent++;
      } catch (e: any) {
        await markStatus(followUp.id, 'failed', e.message);
        failed++;
      }

      // Rate limit — don't hammer WhatsApp API
      await new Promise((r) => setTimeout(r, 500));
    }

    return NextResponse.json({
      processed: pending.length,
      sent,
      skipped,
      failed,
      timestamp: now,
    });
  } catch (error: any) {
    console.error('[CRON ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================
async function markStatus(id: string, status: string, errorMessage?: string) {
  await supabase
    .from('follow_up_schedule')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      error_message: errorMessage || null,
    })
    .eq('id', id);
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
  }
  return out;
}
