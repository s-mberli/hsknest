# Natural pronunciation audio

HSKNest can play natural Mandarin audio for every HSK word and example sentence,
pre-generated once with [edge-tts](https://github.com/rany2/edge-tts) (Microsoft
Edge's free TTS — the Azure neural voices, no API key) and served as static
MP3s. When no audio is configured it falls back to the browser's built-in Web
Speech voice — so this is entirely optional.

> Why edge-tts: small local models (we first tried Kokoro-82M) hallucinate on
> ultra-short input — a lone character like 个 can synthesize as a whole wrong
> phrase. Azure's neural voices read single characters correctly, the way Google
> does. edge-tts needs internet **only during the one-time generation batch**;
> the resulting MP3s are served entirely from your own server, no runtime
> dependency.

## How it works

- The vocabulary is fixed (~11k words + 3k sentences), so clips are generated
  **once**, not on demand — no TTS server runs in production.
- A clip's filename is `sha256(text)[:20].mp3`. The runtime
  (`src/lib/audio.ts`) computes the same hash client-side, so there's no
  database column and no API change: any surface with the text finds its clip.
- Missing clips (custom user words, unsupported languages) transparently fall
  back to Web Speech (`src/lib/speech.ts`).

Layout:

```
/audio/zh/w/<hash>.mp3   # words
/audio/zh/s/<hash>.mp3   # sentences
```

## 1. Generate the clips (one-time)

Runs anywhere with internet — no GPU, no ffmpeg. Synthesis happens on
Microsoft's servers; you just receive the MP3s. It is resumable — re-running
skips existing files.

```bash
pip install edge-tts
python scripts/generate-audio.py               # all words + sentences → ./audio-out/
# pilot one level first (recommended): ~1k clips, a few minutes
python scripts/generate-audio.py --level 1
# options: --voice zh-CN-YunxiNeural (male)   --out /path/to/audio   --limit 20 (smoke test)
```

Output lands in `audio-out/zh/{w,s}/*.mp3` plus a `manifest.json` (every
expected hash, for coverage checks). Total is ~300–500 MB. The full run is
~14k short clips; with the default concurrency expect roughly 20–40 minutes.

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
   # copy audio-out/zh/{w,s}/*.mp3 into <mountpoint>/zh/
   ```
   or, into the running container (same effect, since it's the mounted volume):
   ```bash
   docker cp audio-out/zh/. <app-container>:/app/public/audio/zh/
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
