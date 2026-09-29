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
| 5 · Publish & share | Pay R899 once (Yoco), then publish: permanent link, QR, share buttons |

- **Guest first.** Anyone can build and preview a whole memorial without an account. The draft lives only in the browser (`localStorage`) until they sign up. The dashboard then offers to move it, photo included, into the account.
- **Live Funeral Mode.** The public page `/m/<slug>` switches between "in N days", "today", "happening now", "on the way", "concluded" from the guest's own clock and the stop and programme times. No GPS.
- **Give a memorial.** Anyone can buy a memorial for a grieving family at `/gift`, without an account. They enter the recipient's name and WhatsApp number (email optional), a rough funeral date (or "not sure yet") and a message, then pay. The thank-you page has a **Send on WhatsApp** button that opens the buyer's own WhatsApp with the message and private one-time link ready. The recipient signs up, and the memorial is created already paid for. The team follows up by hand from `/admin`: gifts sorted by funeral date, at-risk ones highlighted, each with a pre-written WhatsApp message, the link, and a "mark contacted" record.
- **Artifact Studio.** After publishing: WhatsApp announcement, square memorial card, journey card, QR card, keepsake card (PNG), printable programme and keepsake book (paginated PDF). All are generated in the browser from the live memorial.
- **Example:** `/m/preview` shows a sample memorial pinned to *today*, so Live Funeral Mode is always visible.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript), deployed on Netlify (or Vercel)
- **Supabase**: Auth (email and password), Postgres with RLS, private Storage
- **Yoco** hosted checkout and signed webhook (ZAR)
- Leaflet + OpenStreetMap, `qrcode`, `jspdf`
- Fonts: Newsreader and Inter, self-hosted via Fontsource

```
src/
  app/                    routes (pages + API route handlers)
    api/memorials/…       create · save · delete · checkout · payment-status · publish
    api/yoco/webhook      signed Yoco webhook (memorial and gift payments)
    api/gifts/…           buy · buyer status · redeem
    api/admin/…           team: mark a gift as contacted
    gift/…                gift form, buyer thank-you page, recipient redeem page
    admin                 team gifts board
    m/[slug]              public memorial (server-rendered, service role)
    memorials/…           dashboard, editor, preview, artifacts (owner only)
  components/             UI (editor steps, memorial view, live panel, share)
  lib/memorial.ts         domain model + the single source of truth for "ready to publish"
  lib/live.ts             Live Funeral Mode state machine
  lib/server/…            data access, Yoco, request guards (server-only)
scripts/                  register-yoco-webhook.mjs
supabase/migrations/      schema, RLS, grants, draft-save RPC, storage policies
tests/                    unit tests (node:test)
```

## Security model

- Every table has RLS **and** least-privilege grants. `anon` has no table access at all.
- Anonymous Supabase users are refused everywhere (restrictive policy). Guest drafts never reach the server.
- The browser can edit only content columns. `status`, `slug`, the publish dates, orders and payments are server-owned and written with the service-role key after checks.
- Publishing re-checks completeness **from the database** (not the browser) and requires a `PAID` order with a `CONFIRMED`, verified payment.
- Payment is confirmed only by fetching the checkout from Yoco's API (triggered by the signed webhook or the return-from-checkout poll) and requiring `completed` with the exact amount, currency and checkout id of the server-owned order. The price is never sent by the browser. Webhook signatures are checked with HMAC-SHA256 plus a 5-minute replay window.
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

## Pricing

One product, **Memora Complete: R899 once-off per memorial** (set in `src/lib/plans.ts`). Building and previewing are free; paying publishes the memorial for **one year**, long enough to update it for the tombstone unveiling. It includes every feature and every download.

How the price was set (South African market, 2026):
- 100 printed A4 programmes cost about R1 000, and programme design about R300–R1 000.
- A newspaper death notice costs R500–R2 000.
- Memory Vault's digital programme renews at R99 a month; Legacy Cloud QR memorials cost R800–R8 000.
- ForeverMissed's lifetime memorial costs about $125–$160, or roughly R2 200–R2 900.
- An average funeral costs R35 000–R45 000.

### Supabase

1. Create a project (or reuse the V1 one; see *Moving from V1* below).
2. Run the files in `supabase/migrations/` in order (SQL editor or `supabase db push`).
3. **Auth → URL configuration**: Site URL = your domain. Redirect URLs: `https://<domain>/auth/confirm`.
4. **Auth → Providers → Email**: keep "Confirm email" on. Turn on leaked-password protection.
5. Copy the publishable key and the **secret** key into the env vars. The secret key is used only on the server.

### Yoco

Memora uses Yoco's hosted **Checkout API**: the family is sent to a Yoco payment page, then back to Memora. Memora never handles card details.

1. **Account:** a Yoco business account with *Online payments / Payment Gateway* switched on (Business Portal → Selling Online → Payment Gateway).
2. **Keys:** in the same area, copy the **test secret key** (`sk_test_…`). Put it in the hosting env as `YOCO_SECRET_KEY`. Never commit it or paste it into a chat.
3. **Deploy** the site so it has a public `https://` URL, with `NEXT_PUBLIC_SITE_URL` set to it.
4. **Webhook:** on your own computer, run
   ```bash
   YOCO_SECRET_KEY=sk_test_xxx node scripts/register-yoco-webhook.mjs https://your-site.netlify.app
   ```
   It registers `https://your-site/api/yoco/webhook` and prints a `whsec_…` secret. Put that in the env as `YOCO_WEBHOOK_SECRET` and redeploy. (`--list` shows what is registered.)
5. **Test:** publish a test memorial and pay with one of Yoco's test cards. You should come back to Memora, see "Payment confirmed", and be able to publish.
6. **Go live:** swap in the **live** secret key (`sk_live_…`), run the webhook script again with it (live and test webhooks are separate), update `YOCO_WEBHOOK_SECRET`, and redeploy.

For local work, `MEMORA_SIMULATE_PAYMENTS=true` records a confirmed payment without Yoco. It is ignored in production.

### Gifts

1. Set `MEMORA_LINK_SECRET` (a long random string). It signs the private gift links, so nothing secret is stored in the database.
2. Set `MEMORA_ADMIN_EMAILS` to the team's emails; they sign up with those emails to open `/admin`.

Nothing is sent automatically yet: the buyer sends the link on WhatsApp and the team follows up from `/admin`. Automatic email (e.g. Resend) and WhatsApp (Meta's Cloud API) can be added later without changing the gift flow.

Gift payments use the same Yoco webhook. A checkout pays either for a memorial or for a gift.

### Contact form

`/contact` posts to Netlify Forms (declared in `public/__forms.html`). To get an email for each message: Netlify → Project → Forms → **Form notifications** → Add notification → Email notification, form `contact`. Free on Netlify's starter plan (100 submissions a month).

### Netlify

Connect the repo; `netlify.toml` builds with `npm run build` and Netlify's Next.js runtime. Add the env vars from `.env.example` in Site settings. `NEXT_PUBLIC_SITE_URL` must be the public URL, because Yoco's success, cancel and failure redirects use it.

## Scripts

| | |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run build` / `start` | production build / serve |
| `npm run lint` · `npm run typecheck` | ESLint (Next + React Compiler rules) · `tsc` |
| `npm test` | unit tests for readiness rules, input sanitising and Live Funeral Mode |

## Moving from V1

V1 was a static single-page app (`app.js`, `backend.js`) with nine Supabase Edge Functions and 20 migrations, shared between families and funeral homes.

**Carried over:** the guest-first flow, the flexible funeral journey and its burial/cremation rules, the programme builder, Live Funeral Mode, all seven artifacts, server-side payment confirmation (a webhook plus a direct check with the provider), private media, the permanent-accounts-only policy, and "a browser can never mark anything paid or published".

**Dropped with Memora Pro:** organisations, branches, staff roles and invites, the Pro dashboard, funeral-home branding, family-information intake links, and family-approval links.

**Changed:**
- Family pricing is now live: one product, R899 for a year (it was parked in V1, where only Pro cases could pay).
- An account can hold several memorials; V1 allowed one.
- Payment and publish are now one step.
- Payments moved from Paystack to Yoco.
- Server logic runs in Next.js route handlers instead of Edge Functions.

To reuse the V1 Supabase project, first check it is still empty, then run `supabase/legacy/drop_memora_v1.sql` (destructive; read its header), delete the V1 Edge Functions, and apply the new migration.
