# Statsman

Privacy-first web analytics for indie blogs — **self-host free** (Docker anywhere) or use the **managed cloud** on the main site.

Cookieless pageviews · ScifiUI console · SQLite or Postgres · Docker-ready.

![Svelte](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=white)
![ScifiUI](https://img.shields.io/badge/ScifiUI-vendored-ff2a6d)
![License](https://img.shields.io/badge/license-MIT-blue)

## How it fits together

| Deploy | Who | `STATSMAN_MODE` | What `/` does |
| --- | --- | --- | --- |
| **Main site** (Railway + Supabase) | Product marketing; your dashboard; later cloud customers | `hosted` → `cloud` when SaaS is live | Landing, pricing, product |
| **Self-host** (any Docker host) | Anyone running their own instance | `selfhost` | Login → dashboard (no marketing) |

**Self-host promise:** if it can run Docker, it can run Statsman. Pick Railway, Render, a VPS, Portainer, etc. Use a volume for SQLite or point `DATABASE_URL` at Postgres (e.g. Supabase).

Same codebase. Cloud customers sign up on the main site. Self-host customers follow [`/self-host`](/self-host).

## Hybrid model

| | Self-host (OSS) | Cloud (on main site) |
| --- | --- | --- |
| Storage | Docker volume (SQLite) or Postgres (`DATABASE_URL`) | Postgres (Supabase) |
| Auth | Optional `ADMIN_TOKEN` | Magic-link email |
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

Run the commercial site on Railway with Supabase:

```bash
STATSMAN_MODE=hosted   # or cloud when multi-user SaaS is live
PUBLIC_ORIGIN=https://your-main-domain
DATABASE_URL=postgres://...   # Supabase
SESSION_SECRET=...
ADMIN_TOKEN=...               # until cloud magic-link is enabled
# cloud extras when ready:
# RESEND_API_KEY=...
# STRIPE_SECRET_KEY=...
# STRIPE_WEBHOOK_SECRET=...
# STRIPE_PRICE_INDIE=price_...
# STRIPE_PRICE_CREATOR=price_...
```

Stripe webhook path: `POST /api/billing/webhook`.

Paid plans use a **native** `/subscribe` page (Stripe Payment Element inside ScifiUI) — not Stripe-hosted Checkout.

### Plans

| Plan | Sites | Pageviews / mo | Price |
| --- | --- | --- | --- |
| Free | 1 | 3,000 | $0 |
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
