-- ============================================================
-- 07_fix_rls_recursion.sql
-- Fix: "stack depth limit exceeded" on /lead-form insert
--
-- The is_team_member() function reads public.team_members, but that
-- table itself has RLS enabled with a policy that calls is_team_member().
-- Every RLS check triggered another RLS check → infinite recursion.
--
-- Fix: mark the function SECURITY DEFINER so it bypasses RLS when it
-- reads team_members. It stays read-only and its result is still scoped
-- to the currently-signed-in user's uid/email.
--
-- Run this once in Supabase → SQL Editor.
-- ============================================================

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

-- Also ensure anon can INSERT a lead when source='website'
-- (this was already added in 06_extras.sql but re-assert to be safe)
DROP POLICY IF EXISTS leads_public_website_insert ON public.leads;
CREATE POLICY leads_public_website_insert ON public.leads
  FOR INSERT TO anon
  WITH CHECK (source = 'website');
