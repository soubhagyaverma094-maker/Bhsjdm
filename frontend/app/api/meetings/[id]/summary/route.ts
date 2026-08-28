// ============================================================
// /app/api/meetings/[id]/summary/route.ts
// Reads meeting.transcript, calls Gemini for summary + next steps,
// writes ai_summary + ai_next_steps back to the row.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, transcript, meeting_type, lead_id')
    .eq('id', id)
    .maybeSingle();

  if (!meeting) return new NextResponse('Meeting not found', { status: 404 });
  if (!meeting.transcript || meeting.transcript.trim().length < 30) {
    return new NextResponse('Transcript too short', { status: 400 });
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('name, company, service_interested, budget_range, ai_reasoning')
    .eq('id', meeting.lead_id)
    .maybeSingle();

  const prompt = `You are analysing a ${meeting.meeting_type} call transcript for a digital marketing agency (Brand Boosting Network).

CLIENT CONTEXT:
Name: ${lead?.name || 'unknown'}
Company: ${lead?.company || 'unknown'}
Service interest: ${lead?.service_interested || 'unclear'}
Budget: ${lead?.budget_range || 'unclear'}

TRANSCRIPT:
"""
${meeting.transcript.slice(0, 25000)}
"""

Return STRICT JSON only, no markdown fences, with this shape:
{
  "summary": "3-6 sentence plain-English summary of what was discussed and where things stand",
  "next_steps": ["short action 1", "short action 2", ...]
}
Next steps: crisp, imperative, max 6 items, focus on what OUR TEAM must do.`;

  let raw: string;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const r = await model.generateContent(prompt);
    raw = r.response.text().trim();
  } catch (e: any) {
    return new NextResponse(`Gemini error: ${e.message}`, { status: 502 });
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
  let parsed: { summary?: string; next_steps?: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: shove the whole thing as summary if it wasn't JSON
    parsed = { summary: cleaned, next_steps: [] };
  }

  await supabase.from('meetings').update({
    ai_summary: parsed.summary || null,
    ai_next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
  }).eq('id', id);

  return NextResponse.json({ ok: true, summary: parsed.summary, next_steps: parsed.next_steps });
}
