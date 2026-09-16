# Self-hosting Statsman

Run Statsman on any Linux box with Docker — a VPS, a home server, a VM.

## Prerequisites

- Docker with compose v2 (`docker compose version`)
- A domain pointed at your box (optional but recommended for HTTPS)
- Optional: Cloudflare in front — its `cf-*` headers give free geo data

## Quick start

```bash
cp .env.example .env
# edit .env — at minimum:
#   PUBLIC_ORIGIN=https://stats.example.com
#   STATSMAN_SESSION_SECRET=$(openssl rand -hex 32)
#   STATSMAN_ADMIN_TOKEN=$(openssl rand -hex 32)   # locks /dashboard
#   POSTGRES_PASSWORD=<something strong>
docker compose up -d --build
curl -s http://localhost:3000/api/health   # → { "ok": true, "mode": "selfhost", "db": "postgres", ... }
```

Open `PUBLIC_ORIGIN`, unlock the dashboard with `STATSMAN_ADMIN_TOKEN` (or
leave it empty for open access), copy the tracker snippet onto your sites.

## Environment variables

The ones that matter for self-host:

| Var | Purpose |
| --- | --- |
| `STATSMAN_MODE` | `selfhost` (default in compose) |
| `PUBLIC_ORIGIN` | Public URL, used for auth/redirects |
| `STATSMAN_SESSION_SECRET` | Cookie signing secret — required in prod |
| `STATSMAN_ADMIN_TOKEN` | Dashboard lock; empty = open local console |
| `DATABASE_URL` | Postgres URL (compose sets it for you) |
| `PGSSLMODE` | `disable` for same-network Postgres (compose default) |
| `STATSMAN_DATABASE_PATH` | SQLite file path (only if not using Postgres) |
| `HOST` / `PORT` | Listen address/port (defaults `::` / `3000`) |
| `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER` | Reverse-proxy trust headers |

Full list with comments: [`.env.example`](.env.example).

## PostgreSQL

`docker-compose.yml` runs `postgres:16-alpine` next to the app on a private
network — the port is not exposed to the host by default. `PGSSLMODE=disable`
is set because there's no TLS on the docker network; keep it `require` (the
default for non-localhost) when connecting to a managed Postgres.

To use an external Postgres instead, drop the `postgres` service and set
`DATABASE_URL` or `PGHOST`/`PGUSER`/`PGPASSWORD` (+ `PGDATABASE`/`PGPORT`).

SQLite alternative: no Postgres at all — set `STATSMAN_DATABASE_PATH=/data/statsman.db`
and mount a volume at `/data` (see the commented block in `docker-compose.yml`).

## Database migrations

There is no separate migrate command. The schema is created and upgraded
automatically at app startup (`CREATE TABLE IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS` in `src/lib/server/db/postgres.ts`, same for the
SQLite store). Migrations are idempotent — restarting the container is safe
and applies any new columns.

## Reverse proxy

Terminate TLS at your proxy and forward to the app. Set the adapter-node
trust headers (see README):

```env
ORIGIN=https://stats.example.com
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=host
ADDRESS_HEADER=x-forwarded-for
```

Caddy:

```caddy
stats.example.com {
	reverse_proxy localhost:3000
}
```

nginx:

```nginx
location / {
	proxy_pass http://localhost:3000;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-Proto $scheme;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Geo: when Cloudflare fronts the site, its `cf-*` headers are used for
country/city. Otherwise the bundled DB-IP City Lite MMDB is the fallback.

## Backups

Postgres:

```bash
docker compose exec postgres pg_dump -U statsman statsman | gzip > backup.sql.gz
# restore:
gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U statsman statsman
```

SQLite: the DB lives in the `statsman-data` volume — stop the app and copy
`statsman.db` out of `/data`.

## Upgrade

```bash
git pull
docker compose up -d --build
curl -s http://localhost:3000/api/health
```

Rollback: `git checkout <previous-tag>` and rebuild — migrations are
additive (`IF NOT EXISTS`), so an older build runs fine against the schema.

## Background jobs

There are none — no cron, no workers. The event buffer is in-process and
flushes to Postgres. Geo databases are baked into the image at build time;
to refresh them, rebuild the image, or run `scripts/fetch-geodb.sh` and
`scripts/fetch-cities.sh` and mount the output over `/app/data`.

## Cloud mode on a VPS

Optional: `STATSMAN_MODE=cloud` turns on marketing pages, signup and Stripe.
Auth still requires Supabase (`SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`)
or a future provider behind `src/lib/server/auth-provider.ts` — that module
is the swap seam. Stripe, Resend and OpenRouter are external SaaS APIs and
work the same anywhere.

## Provider-specific bits that remain

- **Supabase Auth** — isolated in `src/lib/server/auth-provider.ts` (cloud mode only)
- **`railway.toml` + `scripts/railway-start.sh`** — Railway conveniences, harmless elsewhere
- **Cloudflare `cf-*` geo headers** — optional; MMDB fallback covers non-Cloudflare hosts
