# Memora

Memora helps a family create a beautiful funeral memorial: their story, the funeral journey with exact map pins, the order of service, and one link and QR code that guides guests on the day and keeps the programme and keepsakes afterwards.

This is **Memora 2**, a clean rebuild on Next.js + Supabase. The funeral-home product (Memora Pro) has been **removed entirely**. Memora is now family-only.

## What it does

| Step | What the family does |
| --- | --- |
| 1 · Loved one | Portrait (resized on the device), names, the name they were known by, dates |
| 2 · Funeral journey | Burial / cremation / other arrangement, then any number of stops (home, church, hall, cemetery, crematorium, reception, gathering point, custom) with date, times, exact pin, landmark, parking, procession notes. Place search (OpenStreetMap) and "use my location" fill the pin; the pin is always the source of truth. |
| 3 · Story & programme | Life story, family message, and an optional formal order of service (prayer, scripture, hymn, tribute, eulogy…) |
| 4 · Review | Everything in one place, with a readiness checklist and a private preview |
| 5 · Publish & share | One payment (Paystack), then publish: permanent link, QR, share buttons |

- **Guest first.** Anyone can build and preview a whole memorial without an account. The draft lives only in the browser (`localStorage`) until they sign up. The dashboard then offers to move it, photo included, into the account.
- **Live Funeral Mode.** The public page `/m/<slug>` switches between "in N days", "today", "happening now", "on the way", "concluded" from the guest's own clock and the stop and programme times. No GPS.
- **Artifact Studio.** After publishing: WhatsApp announcement, square memorial card, journey card, QR card, keepsake card (PNG), printable programme and keepsake book (paginated PDF). All are generated in the browser from the live memorial.
- **Example:** `/m/preview` shows a sample memorial pinned to *today*, so Live Funeral Mode is always visible.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript), deployed on Netlify (or Vercel)
- **Supabase**: Auth (email and password), Postgres with RLS, private Storage
- **Paystack** checkout and webhook (ZAR)
- Leaflet + OpenStreetMap, `qrcode`, `jspdf`
- Fonts: Newsreader and Inter, self-hosted via Fontsource

```
src/
  app/                    routes (pages + API route handlers)
    api/memorials/…       create · save · delete · checkout · payment-status · publish
    api/paystack/webhook  signed webhook
    m/[slug]              public memorial (server-rendered, service role)
    memorials/…           dashboard, editor, preview, artifacts (owner only)
  components/             UI (editor steps, memorial view, live panel, share)
  lib/memorial.ts         domain model + the single source of truth for "ready to publish"
  lib/live.ts             Live Funeral Mode state machine
  lib/server/…            data access, Paystack, request guards (server-only)
supabase/migrations/      schema, RLS, grants, draft-save RPC, storage policies
tests/                    unit tests (node:test)
```

## Security model

- Every table has RLS **and** least-privilege grants. `anon` has no table access at all.
- Anonymous Supabase users are refused everywhere (restrictive policy). Guest drafts never reach the server.
- The browser can edit only content columns. `status`, `slug`, the publish dates, orders and payments are server-owned and written with the service-role key after checks.
- Publishing re-checks completeness **from the database** (not the browser) and requires a `PAID` order with a `CONFIRMED`, verified payment.
- Payment is confirmed only by asking Paystack's Verify API (from the signed webhook or the return-from-checkout poll) and matching the amount, currency and reference against the server-owned order. The price is never sent by the browser.
- Media is in a private bucket under `<case_id>/…`. Pages get short-lived signed URLs.
- A published memorial cannot be deleted, and saves that would leave it incomplete are rejected.
- The draft save runs as one transaction (`memora_save_draft`) under the caller's RLS.

These rules were exercised against a local Postgres 16 with stand-ins for Supabase's `auth` and `storage` schemas (owner, a second user, an anonymous-auth user and the `anon` role).

## Setup

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run dev                    # http://localhost:3000
```

Without Supabase variables, the guest editor and `/m/preview` still work, which makes design work quick.

### Supabase

1. Create a project (or reuse the V1 one; see *Moving from V1* below).
2. Run `supabase/migrations/0001_memora_family.sql` (SQL editor or `supabase db push`).
3. **Auth → URL configuration**: Site URL = your domain. Redirect URLs: `https://<domain>/auth/confirm`.
4. **Auth → Providers → Email**: keep "Confirm email" on. Turn on leaked-password protection.
5. Copy the publishable key and the **secret** key into the env vars. The secret key is used only on the server.

### Paystack

1. Put `PAYSTACK_SECRET_KEY` (start with `sk_test_…`) in the server env.
2. Paystack → Settings → API Keys & Webhooks → Webhook URL: `https://<domain>/api/paystack/webhook`. Set it separately for Test and Live mode.
3. Run one full test-mode payment before switching to a live key.

Price: `MEMORA_PUBLISH_PRICE_MINOR` (default `29900` = R299, the one price agreed in V1 planning). Public period: `MEMORA_PUBLIC_DAYS` (default 90). For local work, `MEMORA_SIMULATE_PAYMENTS=true` records a confirmed payment without Paystack. It is ignored in production.

### Netlify

Connect the repo; `netlify.toml` builds with `npm run build` and Netlify's Next.js runtime. Add the env vars from `.env.example` in Site settings. `NEXT_PUBLIC_SITE_URL` must be the public URL, because Paystack's callback uses it.

## Scripts

| | |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run build` / `start` | production build / serve |
| `npm run lint` · `npm run typecheck` | ESLint (Next + React Compiler rules) · `tsc` |
| `npm test` | unit tests for readiness rules, input sanitising and Live Funeral Mode |

## Moving from V1

V1 was a static single-page app (`app.js`, `backend.js`) with nine Supabase Edge Functions and 20 migrations, shared between families and funeral homes.

**Carried over:** the guest-first flow, the flexible funeral journey and its burial/cremation rules, the programme builder, Live Funeral Mode, all seven artifacts, Paystack's signed-webhook plus Verify flow, private media, the permanent-accounts-only policy, and "a browser can never mark anything paid or published".

**Dropped with Memora Pro:** organisations, branches, staff roles and invites, the Pro dashboard, funeral-home branding, family-information intake links, and family-approval links.

**Changed:**
- Family pricing is now live (it was parked in V1, where only Pro cases could pay).
- An account can hold several memorials; V1 allowed one.
- Payment and publish are now one step.
- Server logic runs in Next.js route handlers instead of Edge Functions.

To reuse the V1 Supabase project, first check it is still empty, then run `supabase/legacy/drop_memora_v1.sql` (destructive; read its header), delete the V1 Edge Functions, and apply the new migration.
