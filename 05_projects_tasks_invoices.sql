-- ============================================================
-- 05_projects_tasks_invoices.sql
-- Brand Boosting Network — Post-sale workflow tables
--   projects, project_tasks, invoices, onboarding_responses
-- Run AFTER 01_schema.sql
-- ============================================================

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  name text NOT NULL,
  services jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active' CHECK (status IN (
    'onboarding', 'active', 'paused', 'completed', 'cancelled'
  )),
  monthly_value numeric(12,2),
  start_date date DEFAULT current_date,
  end_date date,
  owner_id uuid REFERENCES public.team_members(id),
  brand_guidelines_url text,
  drive_folder_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_lead ON public.projects(lead_id);

-- ============================================================
-- PROJECT TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text DEFAULT 'general' CHECK (task_type IN (
    'content', 'design', 'video', 'ads', 'reporting', 'onboarding', 'general'
  )),
  status text DEFAULT 'todo' CHECK (status IN (
    'todo', 'in_progress', 'internal_review', 'client_review',
    'revision', 'approved', 'published', 'done'
  )),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.team_members(id),
  due_date date,
  asset_url text,
  client_feedback text,
  revision_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.project_tasks(assigned_to);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text UNIQUE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  issue_date date DEFAULT current_date,
  due_date date,
  line_items jsonb DEFAULT '[]'::jsonb,
  -- [{description, quantity, unit_price, total}]
  subtotal numeric(12,2) NOT NULL,
  gst numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  currency text DEFAULT 'INR',
  status text DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'
  )),
  paid_amount numeric(12,2) DEFAULT 0,
  paid_at timestamptz,
  payment_method text,
  payment_ref text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_lead ON public.invoices(lead_id);

-- ============================================================
-- ONBOARDING RESPONSES (welcome form answers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  brand_name text,
  brand_tone text,
  target_audience text,
  competitors text,
  content_examples_url text,
  logo_url text,
  color_palette text,
  social_handles jsonb DEFAULT '{}'::jsonb,
  -- {instagram, facebook, linkedin, ...}
  access_provided jsonb DEFAULT '{}'::jsonb,
  -- {meta_business, google_ads, analytics, drive, ...}
  raw jsonb,
  submitted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_lead ON public.onboarding_responses(lead_id);

-- ============================================================
-- AUTO-CREATE PROJECT WHEN A LEAD IS MARKED WON
-- Fires only on transition into 'won' (not on updates to existing won rows)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_project_on_won()
RETURNS TRIGGER AS $$
DECLARE
  latest_proposal uuid;
  proj_name text;
BEGIN
  IF NEW.stage = 'won' AND (OLD.stage IS DISTINCT FROM 'won') THEN
    SELECT id INTO latest_proposal
      FROM public.proposals
      WHERE lead_id = NEW.id AND status = 'accepted'
      ORDER BY accepted_at DESC NULLS LAST, created_at DESC
      LIMIT 1;

    proj_name := COALESCE(NEW.company, NEW.name, NEW.phone) || ' — Retainer';

    INSERT INTO public.projects (lead_id, proposal_id, name, monthly_value, owner_id, status)
    VALUES (NEW.id, latest_proposal, proj_name, NEW.deal_value, NEW.assigned_to, 'onboarding');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_project ON public.leads;
CREATE TRIGGER trg_auto_create_project
  AFTER UPDATE OF stage ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_project_on_won();

-- ============================================================
-- INVOICE NUMBER AUTOGEN (BBN-YYYY-NNNN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.gen_invoice_no()
RETURNS TRIGGER AS $$
DECLARE
  next_n integer;
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '^BBN-\d{4}-', ''), '')::int), 0) + 1
      INTO next_n
      FROM public.invoices
      WHERE invoice_no LIKE 'BBN-' || to_char(current_date, 'YYYY') || '-%';
    NEW.invoice_no := 'BBN-' || to_char(current_date, 'YYYY') || '-' || lpad(next_n::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gen_invoice_no ON public.invoices;
CREATE TRIGGER trg_gen_invoice_no
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.gen_invoice_no();

-- ============================================================
-- RLS — team members see everything, everyone else nothing
-- (Adjust after you add per-user row-level rules)
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_team ON public.projects;
CREATE POLICY projects_team ON public.projects
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS tasks_team ON public.project_tasks;
CREATE POLICY tasks_team ON public.project_tasks
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS invoices_team ON public.invoices;
CREATE POLICY invoices_team ON public.invoices
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS onboarding_team ON public.onboarding_responses;
CREATE POLICY onboarding_team ON public.onboarding_responses
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Public onboarding form submissions: allow anon INSERT with lead_id
DROP POLICY IF EXISTS onboarding_public_insert ON public.onboarding_responses;
CREATE POLICY onboarding_public_insert ON public.onboarding_responses
  FOR INSERT TO anon WITH CHECK (true);
