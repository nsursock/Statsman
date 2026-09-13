# Statsman

Privacy-first web analytics for indie blogs — **self-host free** (Docker anywhere) or use the **managed cloud** on the main site.

Cookieless pageviews · ScifiUI console · SQLite or Postgres · Docker-ready.

![Svelte](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=white)
![ScifiUI](https://img.shields.io/badge/ScifiUI-vendored-ff2a6d)
![License](https://img.shields.io/badge/license-MIT-blue)

## How it fits together

| Deploy | Who | `STATSMAN_MODE` | What `/` does |
| --- | --- | --- | --- |
| **Self-host** (any Docker host) | You run your own box | `selfhost` | Login → dashboard (no marketing, no Stripe) |
| **Main site** (Railway + Supabase) | Your dogfood / marketing | `hosted` | Landing + your operator dashboard |
| **Cloud SaaS** (Railway + Supabase) | Paying customers (Free → Stripe) | `cloud` | Landing, email/password (Supabase Auth), plans, billing |

**Both product paths are supported:** customers either **self-host** (`STATSMAN_MODE=selfhost`) or use **your cloud** (`STATSMAN_MODE=cloud`). Never set `cloud` on a customer’s Docker box — that forces SaaS login and plan caps.

Same codebase. Cloud customers sign up on the main site. Self-host customers follow [`/self-host`](/self-host).

Local smokes:

```bash
# Cloud multi-tenant (dev already on :5173 with STATSMAN_MODE=cloud)
node scripts/smoke-multi-client.mjs

# Self-host operator (separate port + DB file)
STATSMAN_MODE=selfhost DATABASE_PATH=./data/smoke-selfhost.db \
  PUBLIC_ORIGIN=http://localhost:5174 npm run dev -- --port 5174
SMOKE_BASE=http://localhost:5174 node scripts/smoke-selfhost.mjs
```

## Hybrid model

| | Self-host (OSS) | Cloud (on main site) |
| --- | --- | --- |
| Storage | Docker volume (SQLite) or Postgres (`DATABASE_URL`) | Postgres (Supabase) |
| Auth | Optional `ADMIN_TOKEN` | Supabase Auth (email + password) |
| Limits | Your machine | Free / Indie $9 / Creator $19 |
| Deploy | **Any Docker host** | Railway (app) + Supabase (DB) |

## Quick start (dev)

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). For local marketing UI set `STATSMAN_MODE=hosted`. Pure app UX: `selfhost`.

## Self-host (production)

Step-by-step: [`/self-host`](/self-host).

```bash
docker compose up -d --build
# or deploy the Dockerfile on Railway / Render / your VPS
```

```bash
STATSMAN_MODE=selfhost
PUBLIC_ORIGIN=https://YOUR_PUBLIC_HTTPS_URL
# SQLite (volume) — or Postgres:
# DATABASE_URL=postgres://...
ADMIN_TOKEN=...
SESSION_SECRET=...
```

```html
<script defer src="https://YOUR_PUBLIC_HTTPS_URL/tracker.js" data-site="SITE_ID"></script>
```

Paste into WordPress/Ghost custom code settings.

> Needs a long-running Node container (`adapter-node`). Typical Vercel serverless is a poor fit unless you change adapters. Any Postgres (Supabase, Neon, RDS, …) works via `DATABASE_URL`.

## Demo lab

In `npm run dev`, a **Demo Site** is auto-created (domain `localhost`): the landing page tracks itself into it, and a fake blog lives at [`/demo`](http://localhost:5173/demo) — every click fires a real event. The demo site is backfilled with ~30 days of synthetic traffic so the dashboard looks alive on first boot.

| Env | Default | Purpose |
| --- | --- | --- |
| `STATSMAN_DEMO` | on in dev, off in prod | Enable/disable `/demo` + dogfooding. Set `1` to ship the demo to prod, `0` to mute it in dev. |
| `STATSMAN_DEMO_SEED` | on in dev, off in prod | Backfill synthetic demo traffic (no-op once the site is busy). |

## Cloud mode (main site)

Two billing tiers, controlled by `STATSMAN_BILLING` (selfhost is always free regardless):

- **`beta`** (default) — cloud is free, one tier (1 site, 3k views/mo). No Stripe UI/caps.
- **`normal`** — Starter ($3) / Indie ($9) / Creator ($19) plans via Stripe. Requires Stripe keys + prices.

Paid track (normal): **sign up** (Supabase Auth email + password) → subscribe on `/subscribe` (Stripe Payment Element) → manage on `/billing` (plan change, cancel, update card). No subscription = no sites.

### Deploy checklist (Railway + Supabase + Stripe)

1. **Supabase** — create a project; copy the Postgres connection (URL or `PG*` vars). Prefer the pooled host for the app.
2. **Supabase Auth** — Authentication → Providers → Email on. URL config:
   - Site URL = `PUBLIC_ORIGIN` (e.g. `https://statsman.xyz`)
   - Redirect URLs: `{PUBLIC_ORIGIN}/auth/callback`, `{PUBLIC_ORIGIN}/auth/reset`
   - Redirect allow-list must include `/auth/callback` (and `/auth/reset`). Default confirm links put tokens in the URL hash — Statsman reads those in the browser.
   - **Branded emails** — enable **custom SMTP** (Resend: `smtp.resend.com` / port `465` / user `resend` / pass = API key), then paste HTML from [`email-templates/`](./email-templates/) into Authentication → Email → Templates. See that folder’s README.
3. **Railway** — new service from this repo (uses `Dockerfile` + `railway.toml`). Set env:

```bash
STATSMAN_MODE=cloud
PUBLIC_ORIGIN=https://statsman.xyz
ORIGIN=https://statsman.xyz
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=host
ADDRESS_HEADER=x-forwarded-for
SESSION_SECRET=long-random-string
DATABASE_URL=postgres://...   # or PGHOST/PGUSER/PGPASSWORD/...
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...   # anon / publishable key (Auth only; RLS not used for app DB)
# Billing tier — `beta` (default, free cloud) or `normal` (Free/Indie/Creator via Stripe):
# STATSMAN_BILLING=normal
STATSMAN_FOUNDER_EMAILS=you@example.com
# When STATSMAN_BILLING=normal (Stripe keys required):
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_INDIE=price_...
STRIPE_PRICE_CREATOR=price_...
```

4. **Domain** — attach `statsman.xyz` on Railway; set `PUBLIC_ORIGIN` / `ORIGIN` to `https://statsman.xyz`. Non-canonical hosts (e.g. `*.up.railway.app`) **301** to that origin (except `/api/health`). Point Supabase Auth Site URL + redirects at the same host.
5. **Stripe** (when `STATSMAN_BILLING=normal`)
   - Create Starter ($3) + Indie ($9) + Creator ($19) recurring prices; paste IDs into `STRIPE_PRICE_*`.
   - Webhook endpoint: `https://statsman.xyz/api/billing/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_succeeded`, `invoice_payment.paid`
   - Copy the endpoint signing secret → `STRIPE_WEBHOOK_SECRET`
6. **Smoke** — `GET /api/health` should show `"authReady": true` (and `"billingReady": true` when `STATSMAN_BILLING=normal`). Sign up → confirm email if required → log in → open console.

Do **not** mix test and live keys/prices/webhook secrets.

Local cloud smoke (test mode):

```bash
STATSMAN_MODE=cloud
# test keys + prices in .env
stripe listen --forward-to localhost:5173/api/billing/webhook
```

Stripe webhook: `POST /api/billing/webhook`. Plan promotion happens on **paid invoice** events (not on bare `subscription.updated`).

Flow: Pricing / Settings → signup or login (`next` preserved through Auth redirects) → `/subscribe?plan=indie|creator` → dashboard → `/billing` to change plan, cancel, or update card.

### Plans

| Plan | Sites | Pageviews / mo | Price |
| --- | --- | --- | --- |
| Starter | 1 | 3,000 | $3 |
| Indie | 3 | 100,000 | $9 |
| Creator | 10 | 1,000,000 | $19 |
| Self-host | practical unlimited | practical unlimited | $0 |

Over-cap ingest returns `204` (blogs stay green); dashboard shows an upgrade banner.

## Security

- **Domain allowlist** on `/api/event` when `Origin` / `Referer` is present (site domain must match the blog host)
- **Traffic exclusions** — browser opt-out (`statsman_optout` / `statsman.disableTracking()`), localhost/dev host ignore (default on), optional per-site excluded IPs (filter-only; never stored on events)
- **CSRF origin check disabled** for tracker beacons (`text/plain` cross-origin POSTs); allowlist above is the gate
- **Site ownership** in cloud (users → sites)
- **Optional `ADMIN_TOKEN`** locks self-host dashboard + site CRUD
- Tracker + `/api/event` stay public

## Stack

- SvelteKit + `@sveltejs/adapter-node`
- Vendored [`vendor/scifiui`](vendor/scifiui) (`@scifiui/core`)
- GSAP helpers via ScifiUI · Three.js landing field
- `better-sqlite3` / `postgres` · Stripe · Resend
- Dockerfile + `docker-compose.yml`

## Dogfooding TilBlog

```html
<script defer src="https://YOUR_STATSMAN/tracker.js" data-site="TILBLOG_SITE_ID"></script>
```

## License

MIT
