#!/bin/sh
set -eu
# Railway edge/private network uses IPv6 (see upstreamAddress fd12:…).
# HOST=:: listens on all IPv6 interfaces (dual-stack on Linux). Do NOT use 0.0.0.0 alone.
export HOST="${HOST:-::}"
echo "[statsman] starting node=$(node -v) host=${HOST} port=${PORT:-3000}"
exec node build/index.js
