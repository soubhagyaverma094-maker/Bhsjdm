// ============================================================
// /app/api/leads/[id]/score/route.ts
// Brand Boosting Network — Hot/Cold Lead Scoring + Auto Assignment
// ============================================================
// Called after qualification completes (or manually from dashboard).
// Scores 0-100, classifies hot/warm/cold/dead, triggers assignment,
// schedules temperature-appropriate follow-ups.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ============================================================
// SCORING RUBRIC (100 pts)
// ============================================================
const SYSTEM_PROMPT = `You are a senior sales qualification expert for Brand Boosting Network, a creative digital marketing agency in India.
Score this lead 0-100 based on fit + intent, and classify as hot/warm/cold/dead.

RUBRIC:

1. BUDGET FIT (30 pts) — Brand Boosting Network's sweet spot is ₹25k+/month retainers
   - ₹1L+/month or ₹3L+ one-time: 30 pts
   - ₹50k-1L/month or ₹1-3L one-time: 25 pts
   - ₹25-50k/month or ₹50k-1L one-time: 18 pts
   - ₹10-25k/month or ₹25-50k one-time: 10 pts
   - Under ₹10k or "no budget": 0 pts

2. URGENCY (25 pts)
   - Immediate / this week: 25 pts
   - Within 2-4 weeks: 15 pts
   - Within 1-3 months: 8 pts
   - Just exploring: 0 pts

3. SERVICE CLARITY (20 pts) — matches Brand Boosting Network's core services (branding, social, video, ads, website)
   - Knows exactly + core service: 20 pts
   - Rough idea, core service: 12 pts
   - Vague or non-core (e.g. only SEO or content writing): 6 pts
   - Wants "everything cheap": 0 pts

4. DECISION AUTHORITY (15 pts)
   - Owner/Founder/MD/CEO: 15 pts
   - Marketing Head/CMO/Director: 10 pts
   - Manager (needs approval): 5 pts
   - Junior/employee: 2 pts
   - Unknown: 0 pts

5. ENGAGEMENT QUALITY (10 pts)
   - Detailed replies, asked questions, quick responses: 10 pts
   - Complete short answers: 6 pts
   - One-word / slow replies: 2 pts
   - Ghosted mid-flow: 0 pts

TEMPERATURE:
- 70-100: HOT   → owner/senior sales, respond within 1 hour
- 40-69:  WARM  → sales rep, respond within 24 hours
- 15-39:  COLD  → nurture sequence, weekly touch
- 0-14:   DEAD  → archive

RESPONSE (strict JSON):
{
  "score": <int 0-100>,
  "temperature": "hot" | "warm" | "cold" | "dead",
  "breakdown": {
    "budget_fit": <0-30>,
    "urgency": <0-25>,
    "service_clarity": <0-20>,
    "decision_authority": <0-15>,
    "engagement_quality": <0-10>
  },
  "reasoning": "<2-3 sentence Hinglish note for sales team>",
  "recommended_action": "<specific action, e.g. 'Call within 1 hour, offer branding + social combo'>",
  "risk_flags": ["<red flags like 'price shopping', 'competitor comparison', 'unrealistic timeline'>"],
  "opportunity_flags": ["<positives like 'urgent need', 'strong budget', 'clear vision'>"],
  "suggested_service_bundle": "<what Brand Boosting Network should pitch, e.g. 'Branding + Social Media Retainer'>"
}`;

// ============================================================
// SCORING HANDLER
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id;

  // Allow internal calls OR authenticated dashboard calls
  const internalKey = req.headers.get('x-internal-key');
  const isInternal = internalKey === process.env.INTERNAL_API_KEY;
  // (auth check for dashboard omitted — Supabase RLS + your middleware handles it)

  try {
    // 1. Fetch lead + conversation state
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*, conversation_state(*)')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Recent conversation for context
    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('direction, content')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(25);

    const transcript = (messages || [])
      .map((m: any) => `[${m.direction === 'inbound' ? 'CLIENT' : 'BOT'}]: ${m.content}`)
      .join('\n');

    const collected = lead.conversation_state?.[0]?.collected_data || {};

    // 2. Get settings for Gemini model
    const { data: settings } = await supabase.from('settings').select('gemini_model').eq('id', 1).single();

    const model = genAI.getGenerativeModel({
      model: settings?.gemini_model || 'gemini-2.0-flash-exp',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      systemInstruction: SYSTEM_PROMPT,
    });

    const userPrompt = `LEAD PROFILE:
Name: ${lead.name || 'Unknown'}
Phone: ${lead.phone}
Company: ${lead.company || collected.company || 'Not stated'}
Role: ${lead.role_title || collected.role || 'Not stated'}
City: ${lead.city || collected.city || 'Not stated'}
Source: ${lead.source}

QUALIFICATION:
Service: ${lead.service_interested || collected.service || 'Not stated'}
Budget: ${lead.budget_range || collected.budget || 'Not stated'}
Urgency: ${lead.urgency || collected.urgency || 'Not stated'}

ALL COLLECTED DATA:
${JSON.stringify(collected, null, 2)}

CONVERSATION TRANSCRIPT (${messages?.length || 0} msgs):
${transcript || '(no messages)'}

Score this lead now. Respond in strict JSON.`;

    const result = await model.generateContent(userPrompt);
    const scoreData = JSON.parse(result.response.text());

    // 3. Update lead
    await supabase
      .from('leads')
      .update({
        score: scoreData.score,
        temperature: scoreData.temperature,
        ai_reasoning: scoreData.reasoning,
        ai_recommended_action: scoreData.recommended_action,
        qualification_data: {
          ...lead.qualification_data,
          breakdown: scoreData.breakdown,
          risk_flags: scoreData.risk_flags,
          opportunity_flags: scoreData.opportunity_flags,
          suggested_bundle: scoreData.suggested_service_bundle,
          scored_at: new Date().toISOString(),
        },
      })
      .eq('id', leadId);

    // 4. Log activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: 'score_updated',
      actor_type: 'ai',
      content: `Scored ${scoreData.score}/100 → ${scoreData.temperature.toUpperCase()}. ${scoreData.reasoning}`,
      metadata: scoreData,
    });

    // 5. Auto-assign if hot/warm and unassigned
    if (!lead.assigned_to && ['hot', 'warm'].includes(scoreData.temperature)) {
      await assignLead(leadId, lead.service_interested || collected.service || 'other', scoreData);
    }

    // 6. Schedule follow-up sequence
    await scheduleFollowUps(leadId, scoreData.temperature);

    return NextResponse.json({ success: true, lead_id: leadId, ...scoreData });
  } catch (error: any) {
    console.error('[SCORING ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// AUTO ASSIGNMENT
// ============================================================
async function assignLead(leadId: string, service: string, scoreData: any) {
  // Step 1: Try specialization match
  let { data: matches } = await supabase
    .from('team_members')
    .select('*')
    .eq('is_available', true)
    .contains('specialization', [service]);

  // Fallback: any available member (excluding owner unless hot)
  if (!matches || matches.length === 0) {
    const { data: fallback } = await supabase
      .from('team_members')
      .select('*')
      .eq('is_available', true)
      .in('role', scoreData.temperature === 'hot' ? ['owner', 'admin', 'sales'] : ['sales', 'account_manager']);
    matches = fallback || [];
  }

  if (matches.length === 0) {
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: 'note_added',
      actor_type: 'system',
      content: '⚠️ Auto-assignment failed — no available team member. Owner intervention needed.',
    });
    return;
  }

  // Step 2: Load balancing — pick least-loaded
  const memberIds = matches.map((m) => m.id);
  const { data: loads } = await supabase
    .from('leads')
    .select('assigned_to')
    .in('assigned_to', memberIds)
    .in('stage', ['qualifying', 'qualified', 'meeting_scheduled', 'proposal_sent', 'negotiation']);

  const loadMap: Record<string, number> = {};
  (loads || []).forEach((l: any) => {
    if (l.assigned_to) loadMap[l.assigned_to] = (loadMap[l.assigned_to] || 0) + 1;
  });

  const available = matches
    .filter((m) => (loadMap[m.id] || 0) < (m.max_active_leads || 20))
    .sort((a, b) => (loadMap[a.id] || 0) - (loadMap[b.id] || 0));

  if (available.length === 0) {
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: 'note_added',
      actor_type: 'system',
      content: '⚠️ All matching team members at capacity.',
    });
    return;
  }

  const chosen = available[0];

  // Step 3: Assign
  await supabase
    .from('leads')
    .update({
      assigned_to: chosen.id,
      assigned_at: new Date().toISOString(),
      stage: 'qualified',
    })
    .eq('id', leadId);

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'assigned',
    actor_type: 'system',
    content: `Auto-assigned to ${chosen.full_name} (${chosen.role})`,
    metadata: { assignee_id: chosen.id, service_matched: service },
  });

  // Step 4: WhatsApp notify assignee
  if (chosen.whatsapp_number) {
    const emoji = scoreData.temperature === 'hot' ? '🔥' : '🌡️';
    const notif = `${emoji} *${scoreData.temperature.toUpperCase()} LEAD ASSIGNED*

Score: ${scoreData.score}/100
Service: ${service}
Action: ${scoreData.recommended_action}

_${scoreData.reasoning}_

Open lead: ${process.env.NEXT_PUBLIC_APP_URL}/leads/${leadId}`;

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send-internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({ to: chosen.whatsapp_number, text: notif }),
    }).catch(() => {});
  }
}

// ============================================================
// FOLLOW-UP SCHEDULER
// ============================================================
async function scheduleFollowUps(leadId: string, temperature: string) {
  // Cancel any existing pending
  await supabase
    .from('follow_up_schedule')
    .update({ status: 'cancelled' })
    .eq('lead_id', leadId)
    .eq('status', 'pending');

  const HOUR = 60 * 60 * 1000;
  const now = Date.now();

  const sequences: Record<string, Array<{ hours: number; template: string }>> = {
    hot: [
      { hours: 1, template: 'hot_lead_1h_nudge' },
      { hours: 4, template: 'hot_lead_4h_meeting_offer' },
      { hours: 24, template: 'hot_lead_24h_final' },
    ],
    warm: [
      { hours: 6, template: 'warm_lead_6h_value_share' },
      { hours: 48, template: 'warm_lead_48h_case_study' },
      { hours: 168, template: 'warm_lead_1week_offer' },
    ],
    cold: [
      { hours: 72, template: 'cold_lead_3d_nurture' },
      { hours: 336, template: 'cold_lead_2week_content' },
    ],
    dead: [],
  };

  const seq = sequences[temperature] || [];
  if (seq.length === 0) return;

  const inserts = seq.map((s, idx) => ({
    lead_id: leadId,
    scheduled_at: new Date(now + s.hours * HOUR).toISOString(),
    sequence_step: idx + 1,
    template_key: s.template,
    channel: 'whatsapp',
    status: 'pending',
  }));

  await supabase.from('follow_up_schedule').insert(inserts);
}
