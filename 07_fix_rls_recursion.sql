-- ============================================================
-- 07_fix_rls_recursion.sql
-- Two fixes for the public /lead-form:
--   1. "stack depth limit exceeded" — is_team_member() recursed through
--      team_members RLS. Mark it SECURITY DEFINER so it bypasses RLS
--      when reading team_members.
--   2. "leads_source_check violated" — the schema's source CHECK only
--      allows one of a fixed set (whatsapp_direct, instagram_dm,
--      website_form, facebook_ad, google_ad, referral, walk_in,
--      cold_outreach, other). The earlier anon policy used 'website'
--      which is not in that set. Rewrite the policy to accept
--      'website_form' (the actual schema value the lead-form now sends).
--
-- Run this once in Supabase → SQL Editor.
-- ============================================================

-- 1) is_team_member as SECURITY DEFINER, no recursion
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE auth_user_id = auth.uid()
       OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2) Correct anon-insert policy on leads: match the actual CHECK value
DROP POLICY IF EXISTS leads_public_website_insert ON public.leads;
CREATE POLICY leads_public_website_insert ON public.leads
  FOR INSERT TO anon
  WITH CHECK (source = 'website_form');
