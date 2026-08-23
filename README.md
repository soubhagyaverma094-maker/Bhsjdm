# Brand Boosting Network CRM — Phase 1 Build

**WhatsApp AI chatbot + CRM + Hot/Cold lead scoring + Auto team assignment + Follow-up automation.**

Standalone Next.js + Supabase build. Zero dependency on any other project.

---

## What's included in this build (Phase 1)

| # | Module | File |
|---|---|---|
| 1 | Complete database schema (10 tables + 12 seeded templates) | `01_schema.sql` |
| 2 | WhatsApp webhook + Kiara bot (Hinglish qualification) | `02_whatsapp_webhook.ts` |
| 3 | Gemini-powered lead scoring (0-100) + auto assignment | `03_scoring_and_assignment.ts` |
| 4 | Follow-up cron (drip sequences by temperature) | `04_followup_cron.ts` |

---

## Deployment checklist

### Step 1 — Create fresh Supabase project
1. Go to supabase.com → New project → Name: `brand-boosting-network-crm` → Region: Mumbai (ap-south-1)
2. In SQL Editor, paste + run `01_schema.sql`
3. Verify: `SELECT * FROM public.settings;` should return 1 row

### Step 2 — Meta WhatsApp Business API setup
1. Create Meta Business account → WhatsApp Business Platform
2. Create app → Add WhatsApp product
3. Get: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN` (permanent token, not test)
4. Add Brand Boosting Network's business phone number
5. Webhook URL: `https://<your-vercel-url>/api/whatsapp/webhook`
6. Verify token: any string you choose (put in `WA_VERIFY_TOKEN`)
7. Subscribe to `messages` webhook field

### Step 3 — Deploy Next.js app to Vercel
```bash
npx create-next-app@latest bbn-crm --typescript --app --tailwind
cd bbn-crm
npm install @supabase/supabase-js @google/generative-ai
```

Copy `02_whatsapp_webhook.ts` → `app/api/whatsapp/webhook/route.ts`
Copy `03_scoring_and_assignment.ts` → `app/api/leads/[id]/score/route.ts`
Copy `04_followup_cron.ts` → `app/api/cron/follow-ups/route.ts`

### Step 4 — Environment variables (Vercel dashboard)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # SECRET — service role

# App
NEXT_PUBLIC_APP_URL=https://bbn-crm.vercel.app
INTERNAL_API_KEY=<random-32-char-string>   # for internal endpoint auth

# Google Gemini
GEMINI_API_KEY=AIza...                     # get from aistudio.google.com

# WhatsApp (Meta Cloud API)
WA_PHONE_NUMBER_ID=1234567890
WA_PHONE_NUMBER=+919876543210              # Brand Boosting Network's WA number
WA_ACCESS_TOKEN=EAA...                     # permanent token
WA_VERIFY_TOKEN=<your-chosen-string>

# Cron
CRON_SECRET=<random-32-char-string>
```

### Step 5 — Vercel cron config (`vercel.json`)
```json
{
  "crons": [
    { "path": "/api/cron/follow-ups", "schedule": "*/15 * * * *" }
  ]
}
```

### Step 6 — Seed initial team members
Run in Supabase SQL Editor (replace with real team data):
```sql
INSERT INTO public.team_members (full_name, email, whatsapp_number, role, specialization) VALUES
  ('Brand Boosting Network Owner', 'owner@brandboostingnetwork.com', '919876543210', 'owner',
    ARRAY['branding','social_media','video_production','website','ads']),
  ('Sales Rep 1', 'sales1@brandboostingnetwork.com', '919876543211', 'sales',
    ARRAY['social_media','ads']),
  ('Sales Rep 2', 'sales2@brandboostingnetwork.com', '919876543212', 'sales',
    ARRAY['website','branding']);
```

### Step 7 — Configure Brand Boosting Network settings
```sql
UPDATE public.settings SET
  agency_name = 'Brand Boosting Network',
  agency_phone = '+919876543210',
  agency_email = 'hello@brandboostingnetwork.com',
  agency_website = 'https://brandboostingnetwork.com',
  brand_color = '#FF6B35',
  bot_persona_name = 'Kiara',
  bot_greeting = 'Hi! Brand Boosting Network mein aapka swagat hai 🎨',
  meeting_link_default = 'https://cal.com/bbn/discovery-15min',
  whatsapp_provider = 'meta_cloud'
WHERE id = 1;
```

---

## End-to-end test flow

1. Send WhatsApp message to Brand Boosting Network's number → "Hi, I need social media services"
2. Bot Kiara replies in Hinglish, asks about business
3. Chat naturally through service → business → budget → urgency
4. After 4-5 exchanges, bot calls scoring endpoint
5. Score generated (e.g. 78/100 → HOT)
6. Lead auto-assigned to a sales rep whose specialization matches
7. Sales rep gets WhatsApp notification with full context
8. Follow-up schedule created: 1h, 4h, 24h nudges (if no reply)
9. Cron runs every 15 min and sends due follow-ups
10. Full activity trail visible in `lead_activities` table

---

## What's NOT in Phase 1 (coming in Phase 2/3)

**Phase 2 — Post-deal ops** (~3 sessions):
- Meeting booking widget (Cal.com integration)
- Meeting AI summary (Gemini transcript → summary + next steps)
- Proposal generator (template → PDF via Puppeteer)
- Client onboarding form + document collection
- Project + task auto-creation
- Kanban board UI
- Client approval portal (magic link)

**Phase 3 — Delivery + reporting** (~3 sessions):
- Campaign scheduling calendar
- Meta/Google Ads API ingestion for performance
- Monthly report auto-gen (Gemini + PDF)
- Razorpay invoice + payment link automation
- Client dashboard (view own campaigns/reports)

**Dashboard UI** — This build only ships backend + bot. A React admin dashboard (leads pipeline, kanban, team view, analytics) is a separate session.

---

## Cost estimate (running Brand Boosting Network at ~100 leads/month)

| Service | Cost/month |
|---|---|
| Supabase (Pro if needed, else Free) | ₹0 – ₹2,000 |
| Vercel (Hobby → Pro when scaling) | ₹0 – ₹1,700 |
| Meta WhatsApp API (conversation-based) | ₹500 – ₹3,000 |
| Gemini API (Flash pricing, ~100 leads × 5 calls) | ₹200 – ₹500 |
| Cal.com (free tier) | ₹0 |
| **Total** | **₹700 – ₹7,200/month** |

Scales linearly with lead volume. At 500 leads/month, expect ~₹15-20k.

---

## Known things to adjust before production

1. **WhatsApp templates** — Meta requires pre-approved templates for outbound messages to users who haven't messaged in 24h. Register `hot_lead_1h_nudge`, `warm_lead_6h_value_share` etc. in Meta Business Manager. Within the 24h "customer service window", freeform text works fine.

2. **Rate limits** — Meta Cloud API has tier-based limits (250/day → 1k → 10k → 100k as your quality rating improves). Cron already includes 500ms delay between sends.

3. **Error monitoring** — Add Sentry or LogRocket. All API routes have try/catch but silent failures possible in `.catch(() => {})` blocks.

4. **Backup bot handoff** — Right now if Gemini API fails, no fallback message goes to user. Add a static "System busy, humari team 5 min mein reply karegi" fallback.

5. **Duplicate lead detection** — Currently keyed on phone. If someone messages from a different number, will create duplicate lead. Consider fuzzy match on name + company.

---

## Next session — what to build?

Pick one:
- **A. Admin dashboard UI** (React) — leads pipeline, kanban, team view, activity feed
- **B. Meeting booking + AI summary** — Cal.com webhook + Gemini transcript summarizer
- **C. Proposal generator** — template builder + PDF export + client view page
- **D. Test the full flow end-to-end** — deploy this + set up test WhatsApp + walk through with test messages
