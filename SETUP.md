# Setup — kya karna hai deploy ke baad

Sab code push ho gaya. Ab teen cheez tujhe karni hain (10 min total).

## 1. Database schema Supabase mein run karo

Supabase Dashboard → SQL Editor → New Query

### Query 1: Base schema
Copy the entire contents of **[`01_schema.sql`](./01_schema.sql)** and Run.

### Query 2: Projects + tasks + invoices
Copy the entire contents of **[`05_projects_tasks_invoices.sql`](./05_projects_tasks_invoices.sql)** and Run.

### Query 3: Website intake + payment link + RLS fix
Copy the entire contents of **[`06_extras.sql`](./06_extras.sql)** and Run.
This also fixes RLS so a team_members row without `auth_user_id` works as long as the email matches your login.

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

- ✅ **Leads** — WhatsApp + website form (`/lead-form`) → auto-qualification with Kiara bot → hot/warm/cold scoring → auto-assign → auto follow-ups every 15 min via Vercel Cron
- ✅ **Meetings** (`/meetings`) — schedule, track status, paste transcript, hit **AI summarise** to get Gemini-generated summary + next steps saved to the meeting row
- ✅ **Proposals** — build at `/proposals/new`, share the `/p/[slug]` link, view-count auto-tracks (`sent` → `viewed` → `accepted`)
- ✅ **Projects** — auto-created when a lead's stage flips to `won` (Postgres trigger); kanban task board at `/projects/[id]`
- ✅ **Invoices** — create at `/invoices`, auto-numbered (`BBN-2026-0001`), optional payment link (Razorpay/Stripe/UPI — paste any URL), one-tap mark paid
- ✅ **Reports** (`/reports`) — MRR, close rate, leads-by-source, leads-by-service, outstanding vs paid, all auto-computed
- ✅ **Client onboarding form** — `/onboard/[leadId]`, answers land in `onboarding_responses`

## What's still not automated (yet)

- Cal.com / Google Calendar sync on meetings (currently manual entry)
- Meeting recording/transcription (you paste the transcript — no auto-pull from Zoom/Fireflies)
- Instagram / Facebook DM intake — only WhatsApp + website form for now
- Ad platform metrics ingestion — no Meta Ads / Google Ads pull
- Razorpay/Stripe webhook auto-marking invoices paid (link works, mark-paid is manual)

Ping me when you want any of these next.

## Where to link the public forms

- **Website enquiry form:** put a button on your site → https://bhsjdmhhhh.vercel.app/lead-form
- **Client onboarding:** after you mark a lead `won`, share this with the client → https://bhsjdmhhhh.vercel.app/onboard/{lead-id-from-crm}
