-- ============================================================
-- 06_extras.sql
-- Brand Boosting Network — extras layered on 01+05
--   * fix RLS to accept email match (works without auth_user_id backfill)
--   * public website lead intake policy
--   * invoices.payment_link + meetings.summary_prompt_used columns
--   * lead-source intake helpers
-- Run AFTER 01_schema.sql and 05_projects_tasks_invoices.sql
-- ============================================================

-- ============================================================
-- RLS FIX — team member check accepts email match too, so a fresh
-- team_members row without auth_user_id set still passes RLS as long
-- as its email matches the signed-in user's email.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE auth_user_id = auth.uid()
       OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ============================================================
-- PUBLIC WEBSITE LEAD INTAKE
-- Anon can INSERT a lead only when source='website' (form on your site).
-- Everything else stays team-only.
-- ============================================================
DROP POLICY IF EXISTS leads_public_website_insert ON public.leads;
CREATE POLICY leads_public_website_insert ON public.leads
  FOR INSERT TO anon
  WITH CHECK (source = 'website');

-- ============================================================
-- INVOICES: payment_link column (paste Razorpay/Stripe URL here, share)
-- ============================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_link text;

-- ============================================================
-- MEETINGS: internal_notes prompt-scratchpad column already exists
-- Add a completed_at auto-set trigger when status flips to completed
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_meeting_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_completed ON public.meetings;
CREATE TRIGGER trg_meeting_completed
  BEFORE UPDATE OF status ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_meeting_completed();
