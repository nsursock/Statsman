#!/usr/bin/env bash
# Fetch the world cities SQLite database (simplemaps basic data, via the
# geo2city npm package). Used for local reverse geocoding (lat/lng → city)
# as the standard city-detection method — no network calls at runtime.
# Called by the Dockerfile at build time; safe to re-run (idempotent overwrite).
set -euo pipefail

OUT="${1:-./data/worldcities.db}"
mkdir -p "$(dirname "$OUT")"

# CDNs don't serve the .db binary, so install the package temporarily and
# extract the bundled database. This adds build-time deps only (not shipped).
echo "Fetching worldcities.db → $OUT"
TMP_DIR="$(mktemp -d)"
npm install --prefix "$TMP_DIR" geo2city --no-save --no-audit --no-fund >/dev/null 2>&1
cp "$TMP_DIR/node_modules/geo2city/worldcities.db" "$OUT"
rm -rf "$TMP_DIR"

# Bake a lat/lng index in ahead of time — the DB is opened read-only at
# runtime (may live in a read-only container layer), so it can't be built lazily.
if command -v sqlite3 >/dev/null 2>&1; then
	sqlite3 "$OUT" 'CREATE INDEX IF NOT EXISTS idx_worldcities_latlng ON worldcities (latitude, longitude);'
else
	echo "warning: sqlite3 CLI not found — skipping lat/lng index (reverse geocode will be slower)"
fi

echo "Done: $(du -h "$OUT" | cut -f1) → $OUT"
