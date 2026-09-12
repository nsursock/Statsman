# syntax=docker/dockerfile:1

# Node 24: geoip-lite@2 requires >=24; Railway/Postgres self-host path.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV STATSMAN_MODE=selfhost
ENV DATABASE_PATH=/data/statsman.db
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "build"]
