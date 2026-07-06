#!/bin/sh
set -e

# Ensure the SQLite data directory exists (it's a mounted volume in compose).
mkdir -p /data

# Apply any pending migrations against the live database.
echo "→ Applying database migrations…"
node_modules/.bin/prisma migrate deploy

# Seed starter content exactly once, tracked by a marker on the data volume so
# restarts and re-deploys never re-seed (or clobber user data).
SEED_MARKER=/data/.seeded
if [ ! -f "$SEED_MARKER" ]; then
  echo "→ First boot — seeding starter content…"
  node_modules/.bin/tsx prisma/seed.ts
  touch "$SEED_MARKER"
else
  echo "→ Seed already applied — skipping."
fi

# Hand off to the CMD (node server.js).
exec "$@"
