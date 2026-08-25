#!/bin/sh
# Build a versioned audio release pack tarball from public/audio/.
#
# Maintainer-facing only — self-hosters never run this (see docs/AUDIO.md
# and docker-entrypoint.sh, which download the tarball this produces).
#
# Usage:
#   scripts/build-audio-pack.sh <pack-name> <subpath> <version>
#
# Examples:
#   scripts/build-audio-pack.sh stories zh/r v1
#   scripts/build-audio-pack.sh words zh/w v1
#   scripts/build-audio-pack.sh sentences zh/s v1
#   scripts/build-audio-pack.sh de de v1
#
# <subpath> is relative to public/audio/ — the tarball's internal paths are
# relative to that same root (e.g. "zh/r/hsk1-dumplings.mp3"), never
# "public/audio/...", so the entrypoint can extract straight into the audio
# volume with `tar -C "$AUDIO_ROOT" -xzf`.
#
# Output (in ./dist-audio-packs/): recall-audio-<name>-<version>.tar.gz,
# a per-file manifest.json (path/bytes/sha256), and that tarball's own
# SHA256SUMS entry — upload both to a GitHub Release.

set -e

NAME="$1"
SUBPATH="$2"
VERSION="$3"

if [ -z "$NAME" ] || [ -z "$SUBPATH" ] || [ -z "$VERSION" ]; then
  echo "Usage: $0 <pack-name> <subpath-under-public/audio> <version>" >&2
  exit 1
fi

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
AUDIO_ROOT="$REPO_ROOT/public/audio"
SRC="$AUDIO_ROOT/$SUBPATH"
OUT_DIR="$REPO_ROOT/dist-audio-packs"
TARBALL="recall-audio-$NAME-$VERSION.tar.gz"

if [ ! -d "$SRC" ]; then
  echo "✗ Source directory not found: $SRC" >&2
  echo "  Generate it first — see docs/AUDIO.md." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "→ Building manifest for $NAME ($SUBPATH)…"
MANIFEST="$OUT_DIR/$NAME-$VERSION.manifest.json"
{
  echo "{"
  echo "  \"pack\": \"$NAME\","
  echo "  \"version\": \"$VERSION\","
  echo "  \"files\": ["
  first=true
  find "$SRC" -type f | LC_ALL=C sort | while read -r f; do
    rel=$(echo "$f" | sed "s|^$AUDIO_ROOT/||")
    bytes=$(wc -c < "$f" | tr -d ' ')
    sha=$(sha256sum "$f" | cut -d' ' -f1)
    if [ "$first" = true ]; then first=false; else echo ","; fi
    printf '    {"path": "%s", "bytes": %s, "sha256": "%s"}' "$rel" "$bytes" "$sha"
  done
  echo ""
  echo "  ]"
  echo "}"
} > "$MANIFEST"
echo "→ Wrote $MANIFEST"

echo "→ Building $TARBALL…"
# Paths inside the tarball are relative to public/audio/ (via -C), matching
# the manifest's "path" field and what the entrypoint extracts against.
( cd "$AUDIO_ROOT" && tar -czf "$OUT_DIR/$TARBALL" $(echo "$SUBPATH") )

echo "→ Hashing tarball…"
( cd "$OUT_DIR" && sha256sum "$TARBALL" > "$TARBALL.sha256" )

echo "✓ Done:"
echo "  $OUT_DIR/$TARBALL"
echo "  $OUT_DIR/$TARBALL.sha256"
echo "  $MANIFEST"
echo ""
echo "Upload all three to a GitHub Release, then bump this pack's version in"
echo "audio/PACK_VERSIONS and commit both together (see docs/AUDIO.md)."
