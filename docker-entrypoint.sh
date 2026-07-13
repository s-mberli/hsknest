#!/bin/sh
set -e

# Ensure the SQLite data directory exists (it's a mounted volume in compose).
mkdir -p /data

# Apply any pending migrations against the live database.
echo "→ Applying database migrations…"
node_modules/.bin/prisma migrate deploy

# Seed/refresh starter content only if requested (saves boot time)
if [ "$AUTO_SEED" = "true" ]; then
  echo "→ Seeding starter content…"
  node_modules/.bin/tsx prisma/seed.ts || true
else
  echo "→ Skipping seed (AUTO_SEED!=true)"
fi

# Housekeeping: remove stale guest accounts (non-fatal if it fails).
echo "→ Pruning stale guest accounts…"
node_modules/.bin/tsx scripts/prune-guests.ts || true

# Housekeeping: merge duplicate progress rows from before shared-by-term.
echo "→ Merging duplicate progress…"
node_modules/.bin/tsx scripts/merge-duplicate-progress.ts || true

# Housekeeping: backfill sentence pinyin on DBs seeded before readings existed.
echo "→ Backfilling sentence pinyin…"
node_modules/.bin/tsx scripts/backfill-sentence-pinyin.ts || true

# Hand off to the CMD (node server.js).
exec "$@"
