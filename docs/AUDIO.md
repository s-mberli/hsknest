# Natural pronunciation audio

HSKNest can play natural audio for every word (and, for Mandarin, example
sentence too), pre-generated once with [edge-tts](https://github.com/rany2/edge-tts)
(Microsoft Edge's free TTS — the Azure neural voices, no API key) and served as
static MP3s. When no audio is configured — or for a language with no
generated set — it falls back to the browser's built-in Web Speech voice, so
this is entirely optional. Currently generated: **Mandarin** (`zh`, words +
sentences) and **German** (`de`, words — no example sentences yet). Other
languages (Spanish, or your own CSV import) always use Web Speech.

> Why edge-tts: small local models (we first tried Kokoro-82M) hallucinate on
> ultra-short input — a lone character like 个 can synthesize as a whole wrong
> phrase. Azure's neural voices read single characters correctly, the way Google
> does. edge-tts needs internet **only during the one-time generation batch**;
> the resulting MP3s are served entirely from your own server, no runtime
> dependency.

## How it works

- The vocabulary is fixed, so clips are generated **once per language**, not
  on demand — no TTS server runs in production.
- A clip's filename is `sha256(text)[:20].mp3`. The runtime
  (`src/lib/audio.ts`, `SUPPORTED_AUDIO_LANGS`) computes the same hash
  client-side, so there's no database column and no API change: any surface
  with the text finds its clip.
- Missing clips (custom user words, languages with no generated set)
  transparently fall back to Web Speech (`src/lib/speech.ts`).
- For German, the article is part of the term ("die Familie") and is spoken
  with it — that's the deliberately correct pedagogy (see `prisma/data/de/`),
  not a bug to strip.

Layout, one subtree per language:

```
/audio/zh/w/<hash>.mp3   # Mandarin words
/audio/zh/s/<hash>.mp3   # Mandarin sentences
/audio/de/w/<hash>.mp3   # German words
```

## 1. Generate the clips (one-time per language)

Runs anywhere with internet — no GPU, no ffmpeg. Synthesis happens on
Microsoft's servers; you just receive the MP3s. It is resumable — re-running
skips existing files.

```bash
pip install edge-tts
python scripts/generate-audio.py                # zh (default): all words + sentences → ./audio-out/
python scripts/generate-audio.py --lang de       # German words (~270 clips, ~1 min)
# pilot one HSK level first (recommended for zh): ~1k clips, a few minutes
python scripts/generate-audio.py --level 1
# options: --voice zh-CN-YunxiNeural / de-DE-ConradNeural (male)
#          --out /path/to/audio   --limit 20 (smoke test)
```

Output lands in `audio-out/<lang>/{w,s}/*.mp3` plus a per-language
`manifest.json` (every expected hash, for coverage checks). Mandarin's full
run is ~14k short clips, ~300–500 MB, roughly 20–40 minutes at the default
concurrency. German's ~270 clips take well under a minute.

## 2. Self-hosting: audio installs itself

Self-hosters don't run the generator or `docker cp` anything — the
maintainer already ran step 1 once and published the result as versioned
GitHub Release assets (`scripts/build-audio-pack.sh`), and
`docker-entrypoint.sh` downloads them on boot. This section is for anyone
extending or forking the project; for using it, see the README's "Audio"
section.

The clips live on the named volume `recall-audio`, declared in
`docker-compose.yml` and mounted at `/app/public/audio` in the app container,
so Next serves them at `https://<host>/audio/...` with no extra container.

**Important — this is a compose-managed volume, not a Coolify UI storage
mount.** Coolify's Storage tab is read-only for compose-based apps ("to add,
modify, or manage volumes, edit your Docker Compose file"). The volume is
already declared in the repo's `docker-compose.yml`; you don't add it in the
UI.

**`NEXT_PUBLIC_AUDIO_BASE_URL` is a build-time var**, separate from the
`AUDIO_PACKS` runtime var below. Next.js inlines `NEXT_PUBLIC_*` vars into
the client bundle at build time, so it must be set *before* the image is
built — it's passed through as a Docker build arg (see `docker-compose.yml`'s
`build.args` and the `Dockerfile`'s `ARG`). A runtime-only `environment:`
entry for it is a no-op. It ships pre-set to `/audio` in the repo's
`docker-compose.yml`, so most self-hosters never touch it.

**Pack publication status:** `stories` is published
([Releases](https://github.com/s-mberli/hsknest/releases)) and installs by
default. `words`, `sentences`, and `de` are wired into the same mechanism
(`audio/PACK_VERSIONS`, `docker-entrypoint.sh`) but have no published
release yet — until one exists, setting `AUDIO_PACKS=words` gets a logged
download failure and Web Speech fallback, not an error. Whoever generates
those next just needs to run `scripts/generate-audio.py`, then
`scripts/build-audio-pack.sh` + `gh release create` per "Maintainer:
publishing a pack" below — the download/verify/install side is already
built and doesn't change.

### How the boot-time download works

`docker-entrypoint.sh`, on every boot:

1. Reads `AUDIO_PACKS` (default: `stories`) and looks up each named pack's
   expected version in `audio/PACK_VERSIONS`.
2. Skips a pack if its version marker (`.pack-<name>-<version>`) already
   exists on the volume — so this costs nothing on a normal restart.
3. Otherwise downloads `recall-audio-<name>-<version>.tar.gz` from
   `https://github.com/<AUDIO_PACK_REPO>/releases/download/audio-<name>-<version>/`,
   verifies its SHA-256 against the sidecar `.sha256` file, extracts it into
   the volume, and writes the marker.
4. Never blocks boot on failure — a bad network or missing release logs a
   warning and the app starts anyway (audio is optional; see
   `docs/adr/0001-audio-availability-is-derived.md`). No marker written on
   failure, so the next boot retries automatically.

**Offline server, or want to inspect the pack first?** Download it from
[Releases](https://github.com/s-mberli/hsknest/releases) yourself, verify
the checksum, then either place it where `docker-entrypoint.sh` would find
it, or extract straight onto the volume:
```bash
docker volume inspect <project>_recall-audio --format '{{.Mountpoint}}'
tar -xzf recall-audio-stories-v1.tar.gz -C <mountpoint>
# then touch <mountpoint>/.pack-stories-v1 so the entrypoint doesn't
# re-download it on the next boot
```
Restart the app container afterward — the Next.js standalone server caches
its `public/` directory listing at process startup, so files that land on
the volume without a restart 404 until one happens.

Verify: open a Reading Mode story or a Mandarin flashcard — the Network tab
shows a `200` for `…/audio/zh/...` and the voice is natural.

## 3. Maintainer: publishing a pack after regenerating audio

If you change the seed word/sentence data or add stories, regenerate (step
1 above only synthesizes new/changed text), then:

```bash
# Build the tarball + manifest + checksum for one pack from public/audio/
scripts/build-audio-pack.sh <name> <subpath-under-public/audio> <new-version>
# e.g.: scripts/build-audio-pack.sh stories zh/r v2

# Upload the three output files (in dist-audio-packs/) to a new GitHub
# Release tagged audio-<name>-<new-version>
gh release create audio-<name>-<new-version> dist-audio-packs/recall-audio-<name>-<new-version>.tar.gz{,.sha256} dist-audio-packs/<name>-<new-version>.manifest.json
```

Then **bump that pack's version in `audio/PACK_VERSIONS` in the same commit**
as the content change that made the new audio necessary — that's the whole
drift-detection mechanism. A self-hoster's next redeploy compares the image's
`audio/PACK_VERSIONS` against the marker already on their volume, sees the
mismatch, and re-downloads automatically. Skipping this step means new
content ships with silently stale or missing audio for every existing
self-hosted instance.

## Reading Mode story audio (separate pipeline)

Reading Mode's per-story karaoke audio is a different pipeline from the
hash-addressed word/sentence clips above — it needs one full-story narration
plus word-level timing marks, not per-term clips. Availability is derived
from the filesystem at render time (`src/lib/reading/storyAudio.ts`,
`docs/adr/0001-audio-availability-is-derived.md`) — there's no database row
asserting a story has audio, so the files being present *is* the only
source of truth; nothing to "link" separately.

Maintainer generation, two steps:

```bash
# 1. Generate (free Microsoft Edge TTS — same engine as generate-audio.py
#    above, no API key — using its WordBoundary events for timing). Output:
#    audio-out/zh/r/<slug>.mp3 + <slug>.timings.json
python scripts/generate-story-audio.py

# 2. Sync into the serving location: audio-out/zh → public/audio/zh
python scripts/sync-audio.py
```

Then build and publish the `stories` pack per "Maintainer: publishing a
pack" above. Story content itself is authored as markdown and ingested by
`scripts/ingest-story.ts` — see `docs/content/gemini-prompt.md` for the
authoring/editing workflow (ingest reads/writes story text and metadata;
it has nothing to do with whether that story's audio pack is installed).
