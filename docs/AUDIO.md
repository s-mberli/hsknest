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

## 2. Serve the clips from the VPS

The clips live on the named volume `recall-audio`, declared in
`docker-compose.yml` and mounted at `/app/public/audio` in the app container,
so Next serves them at `https://<host>/audio/...` with no extra container.

**Important — this is a compose-managed volume, not a Coolify UI storage
mount.** Coolify's Storage tab is read-only for compose-based apps ("to add,
modify, or manage volumes, edit your Docker Compose file"). The volume is
already declared in the repo's `docker-compose.yml`; you don't add it in the
UI.

**Two env vars are involved, and they're not the same:**
- `NEXT_PUBLIC_AUDIO_BASE_URL` — a **build-time** var (Next.js inlines
  `NEXT_PUBLIC_*` vars into the client bundle at build). It must be set
  *before* the image is built — it's passed through as a Docker build arg
  (see `docker-compose.yml`'s `build.args` and the `Dockerfile`'s `ARG`).
  Setting only a runtime `environment:` entry for it is a no-op.
- Everything else in `environment:` is runtime and takes effect on container
  start.

Steps:

1. **Set the env var** in Coolify (or `.env` next to `docker-compose.yml`):
   `NEXT_PUBLIC_AUDIO_BASE_URL=/audio`.
2. **Redeploy** — this rebuilds the image (baking in the var) *and* creates
   the `recall-audio` volume on first run if it doesn't exist yet.
3. **Copy the files onto the volume.** The volume is empty after a fresh
   deploy — a redeploy replaces the container, so anything copied into the
   *old* container's filesystem (rather than the volume) is gone. Find the
   volume's host path and copy the generated tree onto it directly, or copy
   into the freshly-deployed container (which now has the volume mounted):
   ```bash
   # from the VPS, find the volume mount and copy the generated audio tree in
   docker volume inspect <project>_recall-audio --format '{{.Mountpoint}}'
   # copy audio-out/<lang>/{w,s}/*.mp3 into <mountpoint>/<lang>/
   ```
   or, into the running container (same effect, since it's the mounted volume):
   ```bash
   docker cp audio-out/zh/. <app-container>:/app/public/audio/zh/
   docker cp audio-out/de/. <app-container>:/app/public/audio/de/
   ```

**Restart the app container after copying files in** — the Next.js standalone
server caches its `public/` directory listing at process startup, so files
added via `docker cp` while it's already running 404 until the process
restarts (`docker restart <app-container>`; no rebuild needed, just a restart).

Verify: open a Mandarin flashcard and reveal the reading — the Network tab shows
a `200` for `…/audio/zh/w/<hash>.mp3` and the voice is natural. Unset the env
(and redeploy) to return to Web Speech.

## Self-hosting

Self-hosted instances default to Web Speech (no setup). To get the natural
clips, run `scripts/generate-audio.py` yourself and mount the output as above —
the audio is not bundled in the Docker image to keep it small.

## Regenerating after data changes

If you change the seed word/sentence data, re-run the generator (it only
synthesizes new/changed text) and copy the new files up. Old, now-unused clips
can be left in place or pruned against the fresh `manifest.json`.
