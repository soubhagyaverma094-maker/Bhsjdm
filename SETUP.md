# Setup — kya karna hai deploy ke baad

Sab code push ho gaya. Ab teen cheez tujhe karni hain (10 min total).

## 1. Database schema Supabase mein run karo

Supabase Dashboard → SQL Editor → New Query

### Query 1: Base schema
Copy the entire contents of **[`01_schema.sql`](./01_schema.sql)** and Run.

### Query 2: Projects + tasks + invoices
Copy the entire contents of **[`05_projects_tasks_invoices.sql`](./05_projects_tasks_invoices.sql)** and Run.

Verify:
```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
```
Should list: `conversation_state`, `follow_up_schedule`, `invoices`, `lead_activities`, `leads`, `meetings`, `message_templates`, `onboarding_responses`, `project_tasks`, `projects`, `proposals`, `settings`, `team_members`, `whatsapp_messages`.

## 2. Vercel environment variables

Vercel → `bhsjdmhhhh` project → Settings → Environment Variables. Add these (Production, Preview, Development — all three):

| Name | Where to get it | Required for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | already set | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | already set | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` `secret` | WhatsApp webhook, scoring, cron |
| `GEMINI_API_KEY` | ai.google.dev → Get API Key | AI qualification + scoring |
| `WA_VERIFY_TOKEN` | any random string you invent (e.g. `bbn-verify-9x7k2`) | WhatsApp webhook handshake |
| `WA_PHONE_NUMBER_ID` | Meta Business → WhatsApp → API Setup → Phone number ID | Sending WhatsApp msgs |
| `WA_ACCESS_TOKEN` | Meta Business → WhatsApp → API Setup → Temporary/Permanent token | Sending WhatsApp msgs |
| `CRON_SECRET` | any random string (e.g. `bbn-cron-8z4h1`) | Protects the follow-up cron endpoint |

Then **Deployments** → ⋯ on latest → Redeploy (uncheck build cache).

## 3. WhatsApp webhook connect

Meta Business → WhatsApp → Configuration → Webhook:

- Callback URL: `https://bhsjdmhhhh.vercel.app/api/whatsapp/webhook`
- Verify Token: whatever you put in `WA_VERIFY_TOKEN` above
- Subscribe to: `messages`, `message_status`

Verify → save. Done — inbound WhatsApp will now hit your CRM.

## 4. Add yourself + team

Supabase → Table Editor → `team_members` → Insert row for each teammate (including you):

- `full_name`, `email`, `role` (`owner` / `sales` / `content` / etc.), `specialization` (array of tags used for auto-assign, e.g. `{"social_media","paid_ads"}`)

Also: Supabase → Authentication → Users → make sure each teammate has an account with same email (Auto Confirm ON).

---

## What's live now

- ✅ **Leads** — WhatsApp inbound → auto-qualification with Kiara bot → hot/warm/cold scoring → auto-assign to right teammate → auto follow-ups every 15 min via Vercel Cron
- ✅ **Proposals** — build one from `/proposals/new`, share the `/p/[slug]` link with the client, view-count and status auto-tracks (`sent` → `viewed` → `accepted`)
- ✅ **Projects** — auto-created the moment you set a lead's stage to `won` (via Postgres trigger); kanban task board at `/projects/[id]`
- ✅ **Invoices** — create at `/invoices`, invoice number auto-generated (`BBN-2026-0001` format), mark paid in one tap
- ✅ **Client onboarding form** — share `/onboard/[leadId]` with a new client, their answers land in `onboarding_responses`

## What's still not automated (yet)

- Meetings booking — table exists (`meetings`), no UI or Cal.com/Google Cal sync yet
- Meeting AI summary — `meetings.ai_summary` column exists, no recorder integration
- Instagram/Facebook/Website form intake — only WhatsApp for now
- Ad platform metrics ingestion — no Meta Ads / Google Ads pull
- Monthly report generation
- Razorpay/Stripe integration on invoices — status is manual "mark paid"

Ping me when you want any of these next.
