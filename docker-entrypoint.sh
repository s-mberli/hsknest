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

# Default READING_MODE_ENABLED to true — Reading Mode's story text is small
# (no audio/font in this step, see docs/AUDIO.md) and ships in every image,
# so it behaves like starter vocab: on by default, one env var to turn off
# for anyone who wants a stripped-down instance.
if [ -z "$READING_MODE_ENABLED" ]; then
  READING_MODE_ENABLED="true"
  echo "→ READING_MODE_ENABLED unset; defaulting to true"
fi

# Ingest Reading Mode's graded stories (idempotent — safe on every boot; see
# scripts/ingest-story.ts's own docstring). --force allows the repo's
# draft-status content through; the human-review gate is for the authoring
# workflow, not for what self-hosters get out of the box.
if [ "$READING_MODE_ENABLED" = "true" ]; then
  echo "→ Ingesting Reading Mode stories…"
  # Non-fatal by design (a content problem shouldn't block boot — the app is
  # fully usable without Reading Mode) but loud on failure: a prior version
  # of this line swallowed the exit code with a bare `|| true`, which let a
  # broken ingest (missing runtime dep) ship silently to production.
  if ! node_modules/.bin/tsx scripts/ingest-story.ts --all --force; then
    echo "⚠ WARNING: Reading Mode ingest failed — /reading will be empty. See the error above." >&2
  fi
else
  echo "→ Skipping Reading Mode ingest (READING_MODE_ENABLED!=true)"
fi

# ---------------------------------------------------------------------------
# Audio packs (see docs/AUDIO.md, audio/PACK_VERSIONS, scripts/build-audio-pack.sh).
# Audio is deliberately not bundled in the image — see
# docs/adr/0001-audio-availability-is-derived.md — so this downloads it from
# versioned GitHub Release assets instead of requiring a Python toolchain +
# `docker cp`. `set +e` for the whole block: a bad network, a missing
# release, or a checksum mismatch must never block boot (audio is optional —
# Reading Mode and flashcards both work without it, falling back to Web
# Speech). No marker written on failure ⇒ automatic retry on the next boot.
set +e

AUDIO_ROOT="/app/public/audio"
PACK_VERSIONS_FILE="/app/audio/PACK_VERSIONS"
AUDIO_REPO="${AUDIO_PACK_REPO:-s-mberli/hsknest}"

if [ -z "${AUDIO_PACKS+x}" ]; then
  # Unset entirely (not just empty) — "${VAR+x}" distinguishes the two, which
  # matters here: AUDIO_PACKS="" is how an operator deliberately disables
  # audio (see docker-compose.yml), and must NOT get overridden back to the
  # default.
  AUDIO_PACKS="stories"
  echo "→ AUDIO_PACKS unset; defaulting to \"stories\" (~10MB, story narration for Reading Mode). Set AUDIO_PACKS=\"stories words sentences\" for word/sentence audio too, or AUDIO_PACKS= to disable."
fi

pack_subpath() {
  case "$1" in
    stories) echo "zh/r" ;;
    words) echo "zh/w" ;;
    sentences) echo "zh/s" ;;
    de) echo "de" ;;
    *) echo "" ;;
  esac
}

pack_version() {
  grep -E "^$1=" "$PACK_VERSIONS_FILE" 2>/dev/null | head -1 | cut -d= -f2
}

if [ -n "$AUDIO_PACKS" ]; then
  mkdir -p "$AUDIO_ROOT"
  for pack in $AUDIO_PACKS; do
    subpath=$(pack_subpath "$pack")
    if [ -z "$subpath" ]; then
      echo "⚠ WARNING: unknown audio pack \"$pack\" in AUDIO_PACKS — skipping. Known packs: stories, words, sentences, de." >&2
      continue
    fi

    version=$(pack_version "$pack")
    if [ -z "$version" ]; then
      echo "⚠ WARNING: no version found for pack \"$pack\" in $PACK_VERSIONS_FILE — skipping." >&2
      continue
    fi

    marker="$AUDIO_ROOT/.pack-$pack-$version"
    if [ -f "$marker" ]; then
      echo "→ Audio pack \"$pack\" ($version) already installed."
      continue
    fi

    if ls "$AUDIO_ROOT"/.pack-"$pack"-* >/dev/null 2>&1; then
      echo "→ Audio pack \"$pack\" is outdated (new version $version available) — fetching update…"
    fi

    # Best-effort free-space guard — `df` output varies by base image, never fatal.
    avail_kb=$(df -Pk "$AUDIO_ROOT" 2>/dev/null | awk 'NR==2 {print $4}')
    if [ -n "$avail_kb" ] && [ "$avail_kb" -lt 204800 ] 2>/dev/null; then
      echo "⚠ WARNING: less than 200MB free on the audio volume — skipping pack \"$pack\" to avoid filling the disk. Free up space and redeploy to retry." >&2
      continue
    fi

    tarball="recall-audio-$pack-$version.tar.gz"
    url="https://github.com/$AUDIO_REPO/releases/download/audio-$pack-$version/$tarball"
    tmp_dir=$(mktemp -d "$AUDIO_ROOT/.pack-download.XXXXXX" 2>/dev/null || mktemp -d)
    echo "→ Fetching audio pack \"$pack\" ($version) from $url …"

    if ! curl -fsSL --max-time 300 -o "$tmp_dir/$tarball" "$url" 2>"$tmp_dir/err.log"; then
      echo "⚠ WARNING: download failed for audio pack \"$pack\" — $(cat "$tmp_dir/err.log" 2>/dev/null). App will boot without it; will retry next boot. To disable, remove \"$pack\" from AUDIO_PACKS. Offline server? See docs/AUDIO.md for the manual docker cp path." >&2
      rm -rf "$tmp_dir"
      continue
    fi

    if ! curl -fsSL --max-time 60 -o "$tmp_dir/$tarball.sha256" "$url.sha256" 2>/dev/null; then
      echo "⚠ WARNING: could not fetch checksum for audio pack \"$pack\" — installing unverified." >&2
    else
      expected=$(awk '{print $1}' "$tmp_dir/$tarball.sha256" 2>/dev/null)
      actual=$(sha256sum "$tmp_dir/$tarball" 2>/dev/null | awk '{print $1}')
      if [ -n "$expected" ] && [ "$expected" != "$actual" ]; then
        echo "⚠ WARNING: checksum mismatch for audio pack \"$pack\" (expected $expected, got $actual) — refusing to install. Will retry next boot." >&2
        rm -rf "$tmp_dir"
        continue
      fi
    fi

    # tmp_dir already lives under $AUDIO_ROOT, so this extraction can't cross
    # a filesystem/volume boundary.
    if tar -xzf "$tmp_dir/$tarball" -C "$AUDIO_ROOT" && touch "$marker"; then
      echo "✓ Installed audio pack \"$pack\" ($version)."
      for old in "$AUDIO_ROOT"/.pack-"$pack"-*; do
        [ "$old" = "$marker" ] || rm -f "$old"
      done
    else
      echo "⚠ WARNING: failed to extract audio pack \"$pack\" — no marker written, will retry next boot." >&2
    fi
    rm -rf "$tmp_dir"
  done
else
  echo "→ AUDIO_PACKS is empty; skipping all audio pack downloads (Web Speech fallback only)."
fi

# Three-line summary, diagnosable from Coolify's log pane alone — no exec
# needed for the common case. Full detail (per-word/sentence counts, DB
# cross-checks) is npm run doctor's job (scripts/doctor.ts); this is
# intentionally just "is the volume there and what got installed".
if [ -d "$AUDIO_ROOT" ]; then
  root_writable="no"
  probe="$AUDIO_ROOT/.entrypoint-write-probe"
  if ( : > "$probe" ) 2>/dev/null; then root_writable="yes"; rm -f "$probe"; fi
  echo "→ audio root: $AUDIO_ROOT (writable: $root_writable)"
else
  echo "→ audio root: $AUDIO_ROOT does not exist"
fi
installed_summary=""
for f in "$AUDIO_ROOT"/.pack-*-*; do
  [ -e "$f" ] || continue
  name=$(basename "$f" | sed 's/^\.pack-//')
  installed_summary="$installed_summary ${name}"
done
echo "→ audio packs installed this boot:${installed_summary:- none}"
story_count=$(find "$AUDIO_ROOT/zh/r" -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')
word_count=$(find "$AUDIO_ROOT/zh/w" -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')
sentence_count=$(find "$AUDIO_ROOT/zh/s" -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')
echo "-> audio: stories ${story_count} mp3, words ${word_count} mp3, sentences ${sentence_count} mp3 (run 'npm run doctor' for full detail)"

set -e

# Hand off to the CMD (node server.js).
exec "$@"
