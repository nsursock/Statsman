# syntax=docker/dockerfile:1

# Node 24: Railway/Postgres self-host path. Geo: Cloudflare cf-ip* headers
# (primary) + local DB-IP MMDB fallback for direct hits. City is always derived
# from coordinates via a local reverse geocoder (worldcities.db) — no network.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ curl sqlite3 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci
COPY . .
RUN npm run build
# Bake geo databases into the image (no license keys; CC BY 4.0).
RUN ./scripts/fetch-geodb.sh /app/data/dbip-city-lite.mmdb
RUN ./scripts/fetch-cities.sh /app/data/worldcities.db

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Railway private network is IPv6 (fd12:…). Bind :: for dual-stack; 0.0.0.0 alone → connection refused.
ENV HOST=::
# Override to cloud on the main product Railway service.
ENV STATSMAN_MODE=selfhost
ENV DATABASE_PATH=/data/statsman.db
ENV STATSMAN_GEODB_PATH=/app/data/dbip-city-lite.mmdb
ENV STATSMAN_CITIES_DB_PATH=/app/data/worldcities.db
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
COPY --from=build /app/data/dbip-city-lite.mmdb /app/data/dbip-city-lite.mmdb
COPY --from=build /app/data/worldcities.db /app/data/worldcities.db
COPY scripts/railway-start.sh ./scripts/railway-start.sh
RUN chmod +x ./scripts/railway-start.sh && mkdir -p /data
EXPOSE 3000
# Listen on Railway's PORT (injected). HOST defaults to 0.0.0.0 in the start script.
CMD ["./scripts/railway-start.sh"]
