#!/usr/bin/env bash
# Fetch DB-IP's free "City Lite" MMDB (CC BY 4.0, no license key, updated
# monthly) for the local GeoIP fallback used when traffic bypasses Cloudflare.
# Called by the Dockerfile at build time; safe to re-run (idempotent overwrite).
set -euo pipefail

OUT="${1:-./data/dbip-city-lite.mmdb}"
mkdir -p "$(dirname "$OUT")"

URL="https://cdn.jsdelivr.net/npm/dbip-city-lite/dbip-city-lite.mmdb.gz"
echo "Fetching DB-IP City Lite MMDB → $OUT"
# -f: fail on HTTP error; pipe through gunzip; write atomically via temp file.
TMP="$OUT.tmp"
curl -fsSL "$URL" | gunzip > "$TMP"
mv "$TMP" "$OUT"
echo "Done: $(du -h "$OUT" | cut -f1) → $OUT"
