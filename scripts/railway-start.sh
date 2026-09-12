#!/bin/sh
set -eu
# Railway injects PORT; bind all interfaces. Do not set PORT yourself in the dashboard
# unless the public domain's target port matches it exactly.
export HOST="${HOST:-0.0.0.0}"
echo "[statsman] starting node=$(node -v) host=${HOST} port=${PORT:-3000}"
exec node build/index.js
