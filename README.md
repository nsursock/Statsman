# Statsman

Privacy-first web analytics for indie blogs — **self-host free** or run the **managed cloud** with Stripe plans.

Cookieless pageviews · ScifiUI console · SQLite or Postgres · Docker-ready.

![Svelte](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=white)
![ScifiUI](https://img.shields.io/badge/ScifiUI-vendored-ff2a6d)
![License](https://img.shields.io/badge/license-MIT-blue)

## Hybrid model

| | Self-host (OSS) | Cloud (paid) |
| --- | --- | --- |
| Storage | SQLite volume | Postgres (`DATABASE_URL`) |
| Auth | Optional `ADMIN_TOKEN` | Magic-link email |
| Limits | Your machine | Free / Indie $9 / Creator $19 |
| Deploy | Fly / VPS / Docker (public URL) | Managed cloud |

## Quick start (dev)

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Dashboard is open in self-host mode unless `ADMIN_TOKEN` is set.

## Self-host (production)

Generic step-by-step: [`/self-host`](/self-host).

**Recommended stack:** [Railway](https://railway.app) (app, Dockerfile) + [Supabase](https://supabase.com) (Postgres). Set `STATSMAN_MODE=selfhost`, `PUBLIC_ORIGIN`, `DATABASE_URL`, `ADMIN_TOKEN`, `SESSION_SECRET`.

```html
<script defer src="https://YOUR_APP.up.railway.app/tracker.js" data-site="SITE_ID"></script>
```

Paste into WordPress/Ghost custom code settings — or set `PUBLIC_ANALYTICS_ORIGIN` + `PUBLIC_ANALYTICS_SITE_ID` on a Statsman marketing deploy.

> Vercel is a poor fit for this repo’s `adapter-node` server; use Railway/Fly/Render for the app. Supabase (or any Postgres) works for the database.

### Docker (laptop or VPS)

```bash
docker compose up -d --build
```

On a VPS, set `PUBLIC_ORIGIN` to your public HTTPS URL (and optionally `DATABASE_URL` for Postgres). Locally: [http://localhost:3000](http://localhost:3000) — fine for UI, not for real traffic.
## Demo lab

In `npm run dev`, a **Demo Site** is auto-created (domain `localhost`): the landing page tracks itself into it, and a fake blog lives at [`/demo`](http://localhost:5173/demo) — every click fires a real event. The demo site is backfilled with ~30 days of synthetic traffic so the dashboard looks alive on first boot.

| Env | Default | Purpose |
| --- | --- | --- |
| `STATSMAN_DEMO` | on in dev, off in prod | Enable/disable `/demo` + dogfooding. Set `1` to ship the demo to prod, `0` to mute it in dev. |
| `STATSMAN_DEMO_SEED` | on in dev, off in prod | Backfill synthetic demo traffic (no-op once the site is busy). |

## Cloud mode

```bash
STATSMAN_MODE=cloud
PUBLIC_ORIGIN=https://your.domain
DATABASE_URL=postgres://...
SESSION_SECRET=...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_INDIE=price_...
STRIPE_PRICE_CREATOR=price_...
```

```bash
npm run build && npm start
# or: fly deploy
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

- **Domain allowlist** on `/api/event` when `Origin` / `Referer` is present (site domain must match the blog host, e.g. `til-blog-kappa.vercel.app`)
- **CSRF origin check disabled** for tracker beacons (`text/plain` cross-origin POSTs); allowlist above is the gate
- **Site ownership** in cloud (users → sites)
- **Optional `ADMIN_TOKEN`** locks self-host dashboard + site CRUD
- Tracker + `/api/event` stay public

## Stack

- SvelteKit + `@sveltejs/adapter-node`
- Vendored [`vendor/scifiui`](vendor/scifiui) (`@scifiui/core`)
- GSAP helpers via ScifiUI · Three.js landing field
- `better-sqlite3` / `postgres` · Stripe · Resend

## Dogfooding TilBlog

Point production TilBlog at your cloud origin + site id:

```html
<script defer src="https://YOUR_CLOUD/tracker.js" data-site="TILBLOG_SITE_ID"></script>
```

Local Eleventy can keep `http://localhost:5173` for the TILOCAL site.

## License

MIT
