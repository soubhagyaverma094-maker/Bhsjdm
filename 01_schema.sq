-- ============================================================
-- Brand Boosting Network CRM — Complete Schema (Standalone Build)
-- Fresh Supabase project — run this ONCE in SQL Editor
-- ============================================================
-- Architecture: Single-tenant (Brand Boosting Network uses it internally)
-- Auth: Supabase Auth (email + magic link for team members)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for lead search


-- 1. TEAM MEMBERS (Brand Boosting Network internal team)
-- ------------------------------------------------------------
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  whatsapp_number text, -- for receiving lead notifications
  role text DEFAULT 'sales' CHECK (role IN ('owner', 'admin', 'sales', 'account_manager', 'designer', 'video_editor', 'ads_specialist')),
  specialization text[] DEFAULT ARRAY[]::text[],
  -- e.g. ['branding', 'social_media', 'video_production', 'website', 'ads', 'seo']
  is_available boolean DEFAULT true,
  max_active_leads integer DEFAULT 20,
  working_hours jsonb DEFAULT '{"start": "10:00", "end": "19:00", "days": [1,2,3,4,5,6], "timezone": "Asia/Kolkata"}'::jsonb,
  avatar_url text,
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_team_available ON public.team_members(is_available);


-- 2. LEADS — the heart of the CRM
-- ------------------------------------------------------------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact
  name text,
  phone text NOT NULL,
  email text,
  company text,
  role_title text, -- their designation
  city text,
  instagram_handle text,

  -- Source tracking
  source text NOT NULL CHECK (source IN (
    'whatsapp_direct', 'instagram_dm', 'website_form',
    'facebook_ad', 'google_ad', 'referral', 'walk_in', 'cold_outreach', 'other'
  )),
  source_details jsonb DEFAULT '{}'::jsonb, -- utm params, ad_id, referrer name, etc.

  -- Qualification
  service_interested text CHECK (service_interested IN (
    'branding', 'social_media', 'video_production', 'website',
    'ads', 'seo', 'photography', 'content_writing', 'full_marketing', 'other', NULL
  )),
  budget_range text CHECK (budget_range IN (
    'under_10k', '10k_25k', '25k_50k', '50k_1L', '1L_3L', '3L_plus', 'unknown', NULL
  )),
  urgency text CHECK (urgency IN ('immediate', 'within_week', 'within_month', 'exploring', NULL)),
  timeline_notes text,

  -- AI Scoring
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  temperature text DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold', 'dead')),
  ai_reasoning text,
  ai_recommended_action text,
  qualification_data jsonb DEFAULT '{}'::jsonb,

  -- Pipeline
  stage text DEFAULT 'new' CHECK (stage IN (
    'new', 'qualifying', 'qualified', 'meeting_scheduled',
    'proposal_sent', 'negotiation', 'won', 'lost'
  )),
  assigned_to uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  assigned_at timestamptz,

  -- Deal
  deal_value numeric(12,2),
  lost_reason text,
  won_at timestamptz,

  -- Timestamps
  last_activity_at timestamptz DEFAULT now(),
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(phone)
);

CREATE INDEX idx_leads_stage ON public.leads(stage, temperature);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to, stage);
CREATE INDEX idx_leads_score ON public.leads(score DESC);
CREATE INDEX idx_leads_phone ON public.leads(phone);
CREATE INDEX idx_leads_search ON public.leads USING gin(
  (coalesce(name,'') || ' ' || coalesce(company,'') || ' ' || phone) gin_trgm_ops
);


-- 3. WHATSAPP MESSAGES (inbound + outbound log)
-- ------------------------------------------------------------
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  wa_message_id text UNIQUE, -- provider's message id (for dedup)
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  content text,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'button', 'list', 'template')),
  media_url text,
  sent_by text CHECK (sent_by IN ('bot', 'ai', 'team_member', 'system', 'client')),
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  status text DEFAULT 'delivered' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_message text,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_wa_lead ON public.whatsapp_messages(lead_id, created_at DESC);
CREATE INDEX idx_wa_msgid ON public.whatsapp_messages(wa_message_id);


-- 4. CONVERSATION STATE (for bot qualification flow)
-- ------------------------------------------------------------
CREATE TABLE public.conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid UNIQUE NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_step text DEFAULT 'greeting' CHECK (current_step IN (
    'greeting', 'ask_service', 'ask_business', 'ask_budget',
    'ask_urgency', 'ask_current_situation', 'offer_meeting',
    'complete', 'human_handoff'
  )),
  collected_data jsonb DEFAULT '{}'::jsonb,
  bot_active boolean DEFAULT true,
  handoff_at timestamptz,
  handoff_reason text,
  last_bot_message_at timestamptz,
  last_user_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- 5. LEAD ACTIVITIES (full audit trail)
-- ------------------------------------------------------------
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'lead_created', 'qualification_started', 'qualification_completed',
    'score_updated', 'assigned', 'reassigned',
    'message_sent', 'message_received',
    'follow_up_scheduled', 'follow_up_sent',
    'meeting_scheduled', 'meeting_completed', 'meeting_no_show',
    'proposal_sent', 'proposal_viewed',
    'stage_changed', 'note_added', 'deal_won', 'deal_lost',
    'human_handoff'
  )),
  actor_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  actor_type text DEFAULT 'system' CHECK (actor_type IN ('system', 'ai', 'team_member', 'client')),
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_lead ON public.lead_activities(lead_id, created_at DESC);


-- 6. FOLLOW-UP SCHEDULE
-- ------------------------------------------------------------
CREATE TABLE public.follow_up_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  sequence_step integer DEFAULT 1,
  template_key text NOT NULL,
  channel text DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed', 'cancelled')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_followup_pending ON public.follow_up_schedule(status, scheduled_at) WHERE status = 'pending';


-- 7. MESSAGE TEMPLATES (Brand Boosting Network's follow-up library, editable from dashboard)
-- ------------------------------------------------------------
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('follow_up', 'meeting', 'proposal', 'onboarding', 'nurture')),
  language text DEFAULT 'hinglish',
  body text NOT NULL, -- supports {{name}}, {{service}}, {{link}} variables
  buttons jsonb DEFAULT '[]'::jsonb, -- WhatsApp interactive buttons
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- 8. MEETINGS
-- ------------------------------------------------------------
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  host_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  meeting_link text,
  meeting_type text DEFAULT 'discovery' CHECK (meeting_type IN (
    'discovery', 'demo', 'proposal_review', 'negotiation', 'onboarding'
  )),
  status text DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled'
  )),
  ai_summary text,
  ai_next_steps jsonb DEFAULT '[]'::jsonb,
  client_notes text,
  internal_notes text,
  recording_url text,
  transcript text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_meetings_scheduled ON public.meetings(scheduled_at, status);


-- 9. PROPOSALS
-- ------------------------------------------------------------
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  services jsonb DEFAULT '[]'::jsonb,
  -- [{name, description, deliverables[], monthly_price, one_time_price, duration_months}]
  subtotal numeric(12,2),
  discount numeric(12,2) DEFAULT 0,
  gst numeric(12,2) DEFAULT 0,
  total numeric(12,2),
  currency text DEFAULT 'INR',
  terms text,
  validity_days integer DEFAULT 15,
  public_slug text UNIQUE, -- bbn.com/p/{slug}
  status text DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
  )),
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer DEFAULT 0,
  accepted_at timestamptz,
  created_by uuid REFERENCES public.team_members(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_proposals_lead ON public.proposals(lead_id);
CREATE INDEX idx_proposals_slug ON public.proposals(public_slug);


-- 10. SETTINGS (single-row config for Brand Boosting Network)
-- ------------------------------------------------------------
CREATE TABLE public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  agency_name text DEFAULT 'Brand Boosting Network',
  agency_phone text,
  agency_email text,
  agency_website text,
  agency_logo_url text,
  brand_color text DEFAULT '#FF6B35',
  bot_persona_name text DEFAULT 'Kiara', -- WhatsApp bot name
  bot_greeting text DEFAULT 'Hi! Brand Boosting Network mein aapka swagat hai 🎨',
  business_hours jsonb DEFAULT '{"start": "10:00", "end": "19:00", "days": [1,2,3,4,5,6], "timezone": "Asia/Kolkata"}'::jsonb,
  meeting_link_default text, -- Cal.com / Calendly / Google Meet default
  gemini_model text DEFAULT 'gemini-2.0-flash-exp',
  whatsapp_provider text DEFAULT 'meta_cloud' CHECK (whatsapp_provider IN ('meta_cloud', 'twilio', 'gupshup', 'wati', 'aisensy')),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;


-- ============================================================
-- SEED: Default message templates (Hinglish)
-- ============================================================
INSERT INTO public.message_templates (template_key, category, body) VALUES

('hot_lead_1h_nudge', 'follow_up',
'Hi {{name}}! 👋
Aapki {{service}} ki requirement dekhi, hum help kar sakte hain.
Aaj free time hai 15-min quick call ke liye? Discuss karte hain how we can grow your brand 🚀'),

('hot_lead_4h_meeting_offer', 'follow_up',
'{{name}}, quick reminder — hamare pass abhi kuch slots open hain aaj/kal ke liye discovery call ke liye. Book here: {{meeting_link}}'),

('hot_lead_24h_final', 'follow_up',
'{{name}}, aap busy lag rahe ho — no worries! Jab bhi ready ho, ye link se apne convenient time pe meeting book kar lena: {{meeting_link}}. Tab tak ke liye humare recent work check karo: {{portfolio_link}}'),

('warm_lead_6h_value_share', 'follow_up',
'Hi {{name}} 🎨
Aapke jaise {{service}} ke clients ke liye humne recently ye kaam kiya tha — {{case_study_link}}. Aisa kuch aapke liye bhi possible hai. Interested?'),

('warm_lead_48h_case_study', 'follow_up',
'{{name}}, ek quick case study share kar rahi hoon — humare ek client ka reach 3 mahine mein 4x hua tha. Details: {{case_study_link}}. Aapke liye custom plan chahiye toh batao 💡'),

('warm_lead_1week_offer', 'follow_up',
'{{name}}, is mahine ke last few slots ke liye special onboarding rate hai. 15-min call book karke details le lo: {{meeting_link}}'),

('cold_lead_3d_nurture', 'nurture',
'Hi {{name}}! Bas check kar rahi thi — kya aap ab bhi {{service}} ke baare mein soch rahe ho? Koi help chahiye ho toh reply kar dena 🙂'),

('cold_lead_2week_content', 'nurture',
'Hi {{name}}! Humne recently ek free guide banayi hai — "5 Marketing Mistakes Indian SMBs Make". Chahiye? Reply "YES" and I''ll share.'),

('meeting_reminder_24h', 'meeting',
'Reminder: Kal {{meeting_time}} par humari meeting hai! Link: {{meeting_link}}. See you soon {{name}} 👋'),

('meeting_reminder_1h', 'meeting',
'{{name}}, humari meeting 1 hour mein hai. Ready ho? Link: {{meeting_link}}'),

('proposal_nudge_2d', 'proposal',
'Hi {{name}}! Proposal dekha? Koi questions ho toh batao, ya call schedule kar lo: {{meeting_link}}'),

('proposal_nudge_5d', 'proposal',
'{{name}}, proposal ki validity {{days_left}} din baaki hai. Kuch clarify karna ho toh reply kar do 🙏');


-- ============================================================
-- ROW LEVEL SECURITY
-- Since single-tenant, RLS is auth-based (team members only)
-- ============================================================
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper: is authenticated user a Brand Boosting Network team member?
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE auth_user_id = auth.uid()
  );
$$;

-- Any team member can read/write everything (small internal team)
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'team_members', 'leads', 'whatsapp_messages', 'conversation_state',
    'lead_activities', 'follow_up_schedule', 'message_templates',
    'meetings', 'proposals', 'settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS team_full_access ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY team_full_access ON public.%I FOR ALL TO authenticated USING (public.is_team_member()) WITH CHECK (public.is_team_member())',
      tbl
    );
  END LOOP;
END $$;

-- Public read for proposals via slug (client viewing without login)
CREATE POLICY proposals_public_slug ON public.proposals
  FOR SELECT TO anon USING (public_slug IS NOT NULL);


-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_lead_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.leads SET last_activity_at = now() WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_lead_activity
AFTER INSERT ON public.lead_activities
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_activity();

CREATE OR REPLACE FUNCTION public.touch_lead_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET last_message_at = now(),
        last_activity_at = now()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_lead_message
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_message();


-- ============================================================
-- DASHBOARD VIEWS
-- ============================================================
CREATE OR REPLACE VIEW public.v_pipeline_summary AS
SELECT
  stage,
  temperature,
  count(*) AS lead_count,
  sum(deal_value) FILTER (WHERE stage = 'won') AS won_value,
  avg(score)::int AS avg_score
FROM public.leads
GROUP BY stage, temperature;

CREATE OR REPLACE VIEW public.v_hot_leads_action_needed AS
SELECT
  l.id, l.name, l.phone, l.company, l.service_interested,
  l.budget_range, l.score, l.temperature, l.stage,
  l.ai_recommended_action,
  tm.full_name AS assignee,
  EXTRACT(EPOCH FROM (now() - l.last_activity_at))/3600 AS hours_since_activity
FROM public.leads l
LEFT JOIN public.team_members tm ON tm.id = l.assigned_to
WHERE l.temperature IN ('hot', 'warm')
  AND l.stage NOT IN ('won', 'lost')
ORDER BY l.score DESC, l.last_activity_at ASC;


-- ============================================================
-- DONE. Verify:
-- SELECT * FROM public.settings;
-- SELECT count(*) FROM public.message_templates;
-- ============================================================
