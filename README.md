# Aangan Studio — AI Phone Receptionist

Answers every call, qualifies the lead, books a consultation for good leads, and hands them to a designer with full context. Every call (qualified or not) is logged in the database (Neon Postgres), the dashboard and the CRM.

**Live:** https://aangan-receptionist-gamma.vercel.app · free voice demo at `/talk`

## Component map

| Step | Component | Tool | What it does | Status |
|---|---|---|---|---|
| Trigger | Customer calls | Vaani (app.vaanivoice.ai) phone agent | Call starts, any hour | ✅ Agent created · ⏸ phone number not bought (paid) |
| Trigger (free) | Browser call | `/talk` page — Chrome Web Speech API + Gemini | Same agent script, spoken in the browser; free alternative to a phone number | ✅ Live |
| Input | Caller details | Vaani / `/talk` | Name, area, company, space type, size, budget, timeline, callback number, email, preferred slot | ✅ |
| Context | Seed data | `seed/services.md`, `seed/qualified.md` | Guide the agent and classifier. `pricing.md` does not exist and is refused by `seed.ts` | ✅ (placeholder content) |
| AI | Voice agent | Vaani (Cartesia voice, Gemini brain) | Consent notice first, qualifying questions, never quotes prices or commits | ✅ |
| Webhook | Post-call event | `POST /api/webhooks/vaani?token=…` | Receives `call_postprocessing`, stores raw event, recovers phone from `call_started` | ✅ Tested |
| Storage | Call log | **Neon Postgres** (replaced Supabase) | `calls`, `bookings`, `crm_mock`, `webhook_events` tables | ✅ |
| Processing | Classifier | **Gemini** (`gemini-3.8-flash`) | Tags qualified / unqualified + one-line reason + category, extracts fields, writes summary | ✅ |
| AI | Booking | **Cal.com** API v2 | Qualified + agreed: books the free slot nearest the caller's preference **right after the call** (Vaani can't call APIs mid-call) | ✅ Real booking tested |
| Output | Designer handoff | **Resend** | Email to the round-robin designer: summary, caller details, booking | ✅ (test sender → own inbox only) |
| Output | CRM | **HubSpot** (service key) | Every lead → contact; qualified → deal (stage: qualified / appointment scheduled) | ✅ Tested |
| Output | Dashboard | Next.js 16 on **Vercel** | Calls today/week/month, after-hours share, answer rate, lead quality, reasons, leads per designer, tool cost; no phone numbers or transcripts | ✅ |
| Code | Repo | **GitHub** (private) | Push to `main` → Vercel deploys | ✅ |

```
Phone call (Vaani)  ─┐                         ┌─ qualified ─→ Cal.com booking → Resend email → HubSpot deal
                     ├─→ save to Neon → Gemini ┤
Browser call (/talk) ─┘                         └─ unqualified → HubSpot contact (logged, never dropped)
                                   ↓
                         Dashboard (Vercel) reads Neon
```

**Cost:** ₹0 — every tool runs on a free tier. Only a real phone number would cost money (Vobiz via Vaani: ₹100 setup + ₹500/month, plus ≈₹5.60/min of Vaani call time).

## Folder structure

```
seed/                    services.md, qualified.md (placeholders — the ONLY files the agent/classifier may load)
samples/                 4 sample calls for the "Simulate call" button
db/schema.sql            calls, bookings, crm_mock tables (Neon Postgres)
scripts/                 print-agent-prompt.mts → paste output into Vaani's agent config
src/proxy.ts             basic auth for dashboard + /api/test-call (DASHBOARD_PASSWORD)
src/app/page.tsx         dashboard (no phone numbers or transcripts)
src/app/api/
  webhooks/vaani/        post-call webhook (signature-verified in real mode)
  test-call/             runs a sample through the whole flow synchronously
  tools/availability/    mid-call tool: next Cal.com slots
  tools/book-consultation/ mid-call tool: book a slot
src/lib/
  voice/                 adapter: vaani.ts (real) | mock.ts, chosen by VAANI_API_KEY
  crm/                   adapter: hubspot.ts (real) | mock.ts → crm_mock table, chosen by HUBSPOT_ACCESS_TOKEN
  pipeline.ts            save → classify → book/assign/email → CRM; each step's failure logged, call never dropped
  classify.ts            Gemini Flash, JSON schema output, cost from token usage
  calcom.ts  email.ts  designers.ts  seed.ts  stats.ts  time.ts  env.ts  db.ts
```

## Setup

1. `npm install`
2. Create a Neon project (neon.tech), open **SQL Editor**, run `db/schema.sql`.
3. `cp .env.example .env.local` and fill in at least `DATABASE_URL` (Neon connection string) and `GEMINI_API_KEY`.
4. `npm run dev` → open http://localhost:3000 → pick a sample → **Simulate call**.

Anything left empty runs in mock/skip mode and shows as a badge on the dashboard:
Vaani → mock webhook, HubSpot → `crm_mock` table, Cal.com → fake bookings, Resend → logged only.
Adding the key to `.env` (and redeploying on Vercel) switches to the real integration; no code changes are needed.

> This machine blocks Next's native compiler (Windows Application Control), so the scripts use `--webpack`. That works the same on Vercel.

## Going live with Vaani Labs

1. `npm run agent-prompt` → paste into the Vaani agent's system prompt. The first message is the recording-consent notice.
2. Webhook URL: `https://<your-app>.vercel.app/api/webhooks/vaani`, event `call.completed`. Put the signing secret in `VAANI_WEBHOOK_SECRET`.
3. Custom tools (if Vaani supports function calling): `POST /api/tools/availability` and `POST /api/tools/book-consultation`
   (body `{ start, name, email, phone, call_id }`), header `x-tool-secret: $VAANI_TOOL_SECRET`.
4. **Verify the payload:** Vaani's docs don't publish `call.completed` field names, so `src/lib/voice/vaani.ts` reads several likely keys. Check the first real payload and adjust.

## Hard rules: where they're enforced

| Rule | Where |
|---|---|
| Never quote prices | `seed.ts` allow-lists only services.md/qualified.md and refuses any `pric*` file; agent prompt forbids it; there is no pricing.md |
| No commitments / complaints | agent prompt (`voice/agent-prompt.ts`) |
| Recording consent | first line of the agent prompt (`CONSENT_GREETING`) |
| Unqualified leads never dropped | `saveCall` runs before anything else; classifier failure → `needs_review`; CRM sync runs for every status |
| No keys in code | everything comes from `env.ts`; `.env*` is gitignored |

## Build plan (small steps)

1. ✅ Scaffold, schema, adapters, mocks, dashboard, simulate button
2. Add Neon `DATABASE_URL` + Gemini key → simulate all 4 samples, check the dashboard + `crm_mock`
3. Add Cal.com (API key, username, event slug) → check that the qualified sample creates a real booking
4. Add Resend + real designer emails → check the handoff email
5. Deploy to Vercel, set env vars and `DASHBOARD_PASSWORD`
6. Vaani keys → configure the agent, webhook and tools → place a real test call → fix field mapping in `vaani.ts`
7. HubSpot private-app token (scopes: crm.objects.contacts.read/write, crm.objects.deals.read/write) → simulate again
8. Polish: call detail page (transcripts behind auth), retry for `needs_review`, WhatsApp/web-form adapters producing `NormalizedCall`
