// ============================================================
// /app/api/whatsapp/webhook/route.ts
// Brand Boosting Network — WhatsApp Webhook + Qualification Bot
// ============================================================
// Handles inbound WhatsApp messages (Meta Cloud API format).
// Bot "Kiara" qualifies leads in Hinglish, extracts structured data,
// hands off to human when qualified or when user asks for human.
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
// WEBHOOK VERIFICATION (Meta Cloud API GET handshake)
// ============================================================
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ============================================================
// INBOUND MESSAGE HANDLER
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Meta Cloud API payload structure
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (!message) {
      // Could be a status update (delivered/read/failed)
      return NextResponse.json({ ok: true });
    }

    const fromNumber = message.from; // e.g. "919876543210"
    const wamid = message.id;
    const messageType = message.type; // text, image, button, etc.
    const messageText =
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '';

    const senderName = contact?.profile?.name || 'Unknown';

    // Dedup by wamid
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('wa_message_id', wamid)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, dedup: true });

    // ---------- 1. Find or create lead ----------
    let { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', fromNumber)
      .maybeSingle();

    let isNewLead = false;
    if (!lead) {
      isNewLead = true;
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          phone: fromNumber,
          name: senderName,
          source: 'whatsapp_direct',
          stage: 'new',
        })
        .select()
        .single();

      if (error) throw error;
      lead = newLead;

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'lead_created',
        actor_type: 'system',
        content: `New lead via WhatsApp: ${senderName} (${fromNumber})`,
      });

      // Initialize conversation state
      await supabase.from('conversation_state').insert({
        lead_id: lead.id,
        current_step: 'greeting',
        bot_active: true,
      });
    }

    // ---------- 2. Log inbound message ----------
    const settings = await getSettings();
    await supabase.from('whatsapp_messages').insert({
      lead_id: lead.id,
      wa_message_id: wamid,
      direction: 'inbound',
      from_number: fromNumber,
      to_number: settings.agency_phone || '',
      content: messageText,
      message_type: messageType,
      sent_by: 'client',
      raw_payload: message,
    });

    // ---------- 3. Check if bot should respond ----------
    const { data: convState } = await supabase
      .from('conversation_state')
      .select('*')
      .eq('lead_id', lead.id)
      .single();

    if (!convState?.bot_active) {
      // Human is handling — just log, don't respond
      return NextResponse.json({ ok: true, handoff: true });
    }

    // Check for human handoff triggers
    const handoffPhrases = [
      'talk to human', 'human se baat', 'insaan se',
      'call me', 'call karo', 'call chahiye',
      'connect me', 'sales team', 'manager',
    ];
    const shouldHandoff = handoffPhrases.some((p) =>
      messageText.toLowerCase().includes(p)
    );

    if (shouldHandoff) {
      await triggerHandoff(lead.id, 'user_requested');
      await sendWhatsApp(fromNumber, {
        text: `Bilkul {{name}}! Main aapko humari team ke ek member se connect kar rahi hoon. Wo aapko 5-10 minute mein reply karenge. 🙂`.replace('{{name}}', lead.name || 'ji'),
      });
      return NextResponse.json({ ok: true, handoff: true });
    }

    // ---------- 4. Generate bot response with Gemini ----------
    const botReply = await generateBotResponse({
      lead,
      convState,
      userMessage: messageText,
      isNewLead,
      settings,
    });

    // Update conversation state
    await supabase
      .from('conversation_state')
      .update({
        current_step: botReply.next_step,
        collected_data: { ...convState.collected_data, ...botReply.extracted_data },
        last_bot_message_at: new Date().toISOString(),
        last_user_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', lead.id);

    // Update lead with extracted data
    if (Object.keys(botReply.extracted_data).length > 0) {
      const updates: any = {};
      if (botReply.extracted_data.service) updates.service_interested = botReply.extracted_data.service;
      if (botReply.extracted_data.budget) updates.budget_range = botReply.extracted_data.budget;
      if (botReply.extracted_data.urgency) updates.urgency = botReply.extracted_data.urgency;
      if (botReply.extracted_data.company) updates.company = botReply.extracted_data.company;
      if (botReply.extracted_data.role) updates.role_title = botReply.extracted_data.role;
      if (botReply.extracted_data.city) updates.city = botReply.extracted_data.city;
      if (botReply.extracted_data.name && !lead.name) updates.name = botReply.extracted_data.name;

      if (Object.keys(updates).length > 0) {
        await supabase.from('leads').update(updates).eq('id', lead.id);
      }
    }

    // ---------- 5. Send bot reply ----------
    await sendWhatsApp(fromNumber, { text: botReply.message });

    // ---------- 6. If qualification complete, trigger scoring + assignment ----------
    if (botReply.next_step === 'complete' || botReply.qualification_done) {
      await supabase.from('leads').update({ stage: 'qualified' }).eq('id', lead.id);

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'qualification_completed',
        actor_type: 'ai',
        content: 'Bot qualification complete. Triggering scoring...',
      });

      // Fire-and-forget scoring (which will trigger assignment if hot/warm)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/${lead.id}/score`, {
        method: 'POST',
        headers: { 'x-internal-key': process.env.INTERNAL_API_KEY! },
      }).catch((e) => console.error('Score trigger failed:', e));
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[WEBHOOK ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// BOT RESPONSE GENERATOR (Gemini)
// ============================================================
async function generateBotResponse({
  lead,
  convState,
  userMessage,
  isNewLead,
  settings,
}: any) {
  // Fetch last 10 messages for context
  const { data: history } = await supabase
    .from('whatsapp_messages')
    .select('direction, content')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: true })
    .limit(10);

  const transcript = (history || [])
    .map((m: any) => `${m.direction === 'inbound' ? 'CLIENT' : 'KIARA'}: ${m.content}`)
    .join('\n');

  const model = genAI.getGenerativeModel({
    model: settings.gemini_model || 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
    systemInstruction: buildSystemPrompt(settings, lead, convState),
  });

  const prompt = `CONVERSATION SO FAR:
${transcript}

CURRENT STEP: ${convState.current_step}
COLLECTED DATA: ${JSON.stringify(convState.collected_data)}

USER'S LATEST MESSAGE:
"${userMessage}"

Respond in strict JSON format:
{
  "message": "<Hinglish reply — warm, professional, agency-like>",
  "next_step": "greeting | ask_service | ask_business | ask_budget | ask_urgency | ask_current_situation | offer_meeting | complete | human_handoff",
  "extracted_data": {
    "name": "<if newly mentioned>",
    "service": "<branding|social_media|video_production|website|ads|seo|photography|content_writing|full_marketing|other>",
    "budget": "<under_10k|10k_25k|25k_50k|50k_1L|1L_3L|3L_plus|unknown>",
    "urgency": "<immediate|within_week|within_month|exploring>",
    "company": "<if mentioned>",
    "role": "<if mentioned>",
    "city": "<if mentioned>"
  },
  "qualification_done": <true|false — true when you have: service + budget + urgency>
}

Only include extracted_data fields that were newly revealed in this message. Omit unknowns.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

// ============================================================
// SYSTEM PROMPT — Kiara's persona
// ============================================================
function buildSystemPrompt(settings: any, lead: any, convState: any) {
  return `You are ${settings.bot_persona_name || 'Kiara'}, the friendly AI assistant for ${settings.agency_name || 'Brand Boosting Network'}, a creative digital marketing agency in India.

YOUR JOB: Qualify inbound WhatsApp leads by having a natural, warm Hinglish conversation. You need to figure out:
1. What service they need (branding, social media, video, website, ads, SEO, photography, content, or full marketing)
2. Their monthly/project budget range
3. How urgent it is
4. What business they run + their role
5. Their city

CONVERSATION STYLE:
- Hinglish (Hindi-English mix) — natural, warm, like a helpful friend
- Use 1-2 emojis per message max
- Keep replies SHORT (2-3 lines) — this is WhatsApp, not email
- Ask ONE question at a time — never multiple
- Match their energy — if they're formal, be formal; casual, be casual
- If they type in pure English or pure Hindi, match their language
- Never sound scripted or robotic
- Genuinely acknowledge their answers before asking the next question

CONVERSATION FLOW (adapt naturally, don't force):
- greeting: Welcome them, ask what they're looking for
- ask_service: Understand the specific service if unclear
- ask_business: Learn about their business/niche
- ask_budget: Ask budget SOFTLY — "koi rough budget in mind?" not "what's your budget?"
- ask_urgency: When do they want to start
- ask_current_situation: What have they tried? What's not working?
- offer_meeting: Once qualified, offer a discovery call
- complete: All data captured, hand off to human

BUDGET QUESTIONS — ask indirectly:
- "Aapke mind mein koi monthly investment range hai marketing ke liye?"
- "Rough budget kya soch rahe ho?"
- Never ask like an interrogation

WHEN TO HAND OFF TO HUMAN (set next_step: "human_handoff"):
- User explicitly asks to speak to someone
- User is angry or complains
- User asks a very technical/specific question you can't answer
- User is clearly a hot lead ready to sign — pass to sales

WHEN TO OFFER MEETING (next_step: "offer_meeting"):
- You have service + budget + urgency
- User seems engaged and interested
- Offer: "Ek 15-min quick call schedule kar lein? {{meeting_link}}"

FIRST MESSAGE (isNewLead=true, current_step=greeting):
"${settings.bot_greeting || 'Hi! Brand Boosting Network mein aapka swagat hai 🎨'} Main ${settings.bot_persona_name || 'Kiara'} hoon. Kya help chahiye aapko — koi specific service in mind hai?"

CURRENT LEAD CONTEXT:
- Name: ${lead.name || 'unknown'}
- Company: ${lead.company || 'unknown'}
- Already collected: ${JSON.stringify(convState.collected_data)}

Now respond to the user's latest message in the required JSON format.`;
}

// ============================================================
// HELPERS
// ============================================================
async function getSettings() {
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
  return data || {};
}

async function triggerHandoff(leadId: string, reason: string) {
  await supabase
    .from('conversation_state')
    .update({
      bot_active: false,
      handoff_at: new Date().toISOString(),
      handoff_reason: reason,
      current_step: 'human_handoff',
    })
    .eq('lead_id', leadId);

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'human_handoff',
    actor_type: 'system',
    content: `Bot handed off to human. Reason: ${reason}`,
  });

  // Also trigger scoring + assignment so human sees a prioritized queue
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/${leadId}/score`, {
    method: 'POST',
    headers: { 'x-internal-key': process.env.INTERNAL_API_KEY! },
  }).catch(() => {});
}

// WhatsApp sender — Meta Cloud API
async function sendWhatsApp(to: string, payload: { text: string }) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: payload.text },
    }),
  });

  const data = await res.json();

  // Log outbound
  const { data: lead } = await supabase.from('leads').select('id').eq('phone', to).single();
  if (lead) {
    await supabase.from('whatsapp_messages').insert({
      lead_id: lead.id,
      wa_message_id: data.messages?.[0]?.id,
      direction: 'outbound',
      from_number: process.env.WA_PHONE_NUMBER!,
      to_number: to,
      content: payload.text,
      sent_by: 'bot',
      status: res.ok ? 'sent' : 'failed',
      raw_payload: data,
    });
  }

  return data;
}
