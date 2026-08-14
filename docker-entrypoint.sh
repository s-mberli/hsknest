#!/bin/sh
set -e

# Ensure the SQLite data directory exists (it's a mounted volume in compose).
mkdir -p /data

# Generate NEXTAUTH_SECRET if it doesn't exist and persist it so it survives restarts.
# A regenerated secret would invalidate every session, so we persist it.
if [ -z "$NEXTAUTH_SECRET" ]; then
  SECRET_FILE="/data/.nextauth-secret"
  if [ -f "$SECRET_FILE" ]; then
    export NEXTAUTH_SECRET=$(cat "$SECRET_FILE")
    chmod 600 "$SECRET_FILE" 2>/dev/null || true
    echo "→ Using persisted NEXTAUTH_SECRET from /data/.nextauth-secret"
  else
    # Generate a 32-byte base64 secret (compatible with NextAuth expectations).
    # No fallback to a fixed string here on purpose: a hardcoded secret baked
    # into a public repo is a known-value session-signing key, worse than
    # refusing to start. If neither source of randomness is available, fail
    # loudly instead of silently shipping a guessable secret.
    if command -v openssl > /dev/null 2>&1; then
      export NEXTAUTH_SECRET=$(openssl rand -base64 32)
    elif [ -r /dev/urandom ]; then
      export NEXTAUTH_SECRET="$(head -c 32 /dev/urandom | base64)"
    else
      echo "✗ FATAL: no secure random source available (openssl and /dev/urandom both missing) — cannot generate NEXTAUTH_SECRET. Set NEXTAUTH_SECRET explicitly in your environment." >&2
      exit 1
    fi
    # Persist it so the next boot uses the same secret. Restrict permissions —
    # this file is a session-signing key sitting next to the database.
    if echo "$NEXTAUTH_SECRET" > "$SECRET_FILE"; then
      chmod 600 "$SECRET_FILE" 2>/dev/null || true
      echo "→ Generated and persisted NEXTAUTH_SECRET to /data/.nextauth-secret"
    else
      echo "⚠ WARNING: Could not persist NEXTAUTH_SECRET — /data may not be writable. Using ephemeral secret; sessions will invalidate on restart."
    fi
  fi
fi

# Default AUTO_SEED to true for first-time docker run (without compose env vars).
# This ensures self-hosters get starter content on boot.
if [ -z "$AUTO_SEED" ]; then
  AUTO_SEED="true"
  echo "→ AUTO_SEED unset; defaulting to true"
fi

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
