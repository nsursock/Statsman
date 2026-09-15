#!/usr/bin/env bash
# Fetch the world cities SQLite database (simplemaps basic data, via the
# geo2city npm package). Used for local reverse geocoding (lat/lng → city)
# as the standard city-detection method — no network calls at runtime.
# Called by the Dockerfile at build time; safe to re-run (idempotent overwrite).
set -euo pipefail

OUT="${1:-./data/worldcities.db}"
mkdir -p "$(dirname "$OUT")"

# `npm pack` downloads just the package tarball (no dependency install, no
# native modules) and extracts the bundled worldcities.db.zip from it.
# This avoids pulling in geo2city's 85 build-time deps (including native sqlite3).
echo "Fetching worldcities.db → $OUT"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
npm pack geo2city --pack-destination "$TMP_DIR" --loglevel=error
tar xzf "$TMP_DIR"/geo2city-*.tgz -C "$TMP_DIR"
# unzip via python3 (already installed in the build stage; `unzip` may not be).
python3 -m zipfile -e "$TMP_DIR/package/worldcities.db.zip" "$TMP_DIR"
cp "$TMP_DIR/worldcities.db" "$OUT"

# Bake a lat/lng index in ahead of time — the DB is opened read-only at
# runtime (may live in a read-only container layer), so it can't be built lazily.
if command -v sqlite3 >/dev/null 2>&1; then
	sqlite3 "$OUT" 'CREATE INDEX IF NOT EXISTS idx_worldcities_latlng ON worldcities (latitude, longitude);'
else
	echo "warning: sqlite3 CLI not found — skipping lat/lng index (reverse geocode will be slower)"
fi

echo "Done: $(du -h "$OUT" | cut -f1) → $OUT"
