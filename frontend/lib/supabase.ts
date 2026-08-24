// ============================================================
// lib/supabase.ts
// Brand Boosting Network CRM — Supabase client (browser only)
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================================
// Types (match schema in 01_schema.sql)
// ============================================================
export type Temperature = 'hot' | 'warm' | 'cold' | 'dead';
export type LeadStage =
  | 'new' | 'qualifying' | 'qualified' | 'meeting_scheduled'
  | 'proposal_sent' | 'negotiation' | 'won' | 'lost';

export interface Lead {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  role_title: string | null;
  city: string | null;
  source: string;
  service_interested: string | null;
  budget_range: string | null;
  urgency: string | null;
  score: number;
  temperature: Temperature;
  ai_reasoning: string | null;
  ai_recommended_action: string | null;
  qualification_data: Record<string, any>;
  stage: LeadStage;
  assigned_to: string | null;
  assigned_at: string | null;
  deal_value: number | null;
  last_activity_at: string;
  last_message_at: string | null;
  created_at: string;
  team_member?: TeamMember | null;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  specialization: string[];
}

export interface WhatsAppMessage {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  sent_by: string;
  created_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  actor_type: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ============================================================
// Utilities
// ============================================================
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export function formatBudget(range: string | null): string {
  if (!range) return 'Budget unclear';
  const map: Record<string, string> = {
    under_10k: 'Under ₹10k/mo',
    '10k_25k': '₹10-25k/mo',
    '25k_50k': '₹25-50k/mo',
    '50k_1L': '₹50k-1L/mo',
    '1L_3L': '₹1-3L/mo',
    '3L_plus': '₹3L+/mo',
    unknown: 'Budget unclear',
  };
  return map[range] || range;
}

export function formatService(s: string | null): string {
  if (!s) return 'Service TBD';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '');
}
