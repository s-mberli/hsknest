#!/bin/sh
set -e

# Ensure the SQLite data directory exists (it's a mounted volume in compose).
mkdir -p /data

# Apply any pending migrations against the live database.
echo "→ Applying database migrations…"
node_modules/.bin/prisma migrate deploy

# Seed/refresh starter content on every boot. The seed is idempotent: existing
# lists with current content are no-ops, outdated seeded lists are replaced
# only when no user progress references them (studied lists are kept as
# "… (legacy)"), and user data is never touched.
echo "→ Seeding starter content…"
node_modules/.bin/tsx prisma/seed.ts || true

# Housekeeping: remove stale guest accounts (non-fatal if it fails).
echo "→ Pruning stale guest accounts…"
node_modules/.bin/tsx scripts/prune-guests.ts || true

# Housekeeping: merge duplicate progress rows from before shared-by-term.
echo "→ Merging duplicate progress…"
node_modules/.bin/tsx scripts/merge-duplicate-progress.ts || true

# Hand off to the CMD (node server.js).
exec "$@"
