# Natural pronunciation audio

HSKNest can play natural Mandarin audio for every HSK word and example sentence,
pre-generated once with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)
(Apache-2.0) and served as static MP3s. When no audio is configured it falls
back to the browser's built-in Web Speech voice — so this is entirely optional.

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

## 1. Generate the clips (one-time, offline)

Do this on a machine with a GPU (a free Colab GPU does ~14k clips in ~15 min) or
locally on CPU (slower but fine). It is resumable — re-running skips existing
files.

```bash
pip install kokoro "misaki[zh]" soundfile   # plus ffmpeg on PATH
python scripts/generate-audio.py            # → ./audio-out/
# options: --voice zf_xiaoni   --out /path/to/audio   --limit 50 (smoke test)
```

Output lands in `audio-out/zh/{w,s}/*.mp3` plus a `manifest.json` (every
expected hash, for coverage checks). Total is ~300–500 MB.

## 2. Serve the clips from the VPS

The clips live on a persistent volume mounted into the app container at
`/app/public/audio`, so Next serves them at `https://<host>/audio/...` with no
extra container.

1. **Add the mount** (Coolify → the app → Storage, or `docker-compose.yml`):
   mount a named volume `recall-audio` at `/app/public/audio` (read-only is
   fine for the app).
2. **Copy the files up** to the VPS, then into the volume:
   ```bash
   rsync -av audio-out/zh/  your-user@your-vps:/tmp/audio-zh/
   # on the VPS, into the running app container:
   docker cp /tmp/audio-zh/. <app-container>:/app/public/audio/zh/
   ```
   (Or rsync straight into the volume's host path from `docker volume inspect`.)
3. **Enable it**: set `NEXT_PUBLIC_AUDIO_BASE_URL=/audio` in the app's
   environment and redeploy. (It's a build-time public var, so a rebuild/redeploy
   is required — not just a restart.)

Verify: open a Mandarin flashcard and reveal the reading — the Network tab shows
a `200` for `…/audio/zh/w/<hash>.mp3` and the voice is natural. Unset the env to
return to Web Speech.

## Self-hosting

Self-hosted instances default to Web Speech (no setup). To get the natural
clips, run `scripts/generate-audio.py` yourself and mount the output as above —
the audio is not bundled in the Docker image to keep it small.

## Regenerating after data changes

If you change the seed word/sentence data, re-run the generator (it only
synthesizes new/changed text) and copy the new files up. Old, now-unused clips
can be left in place or pruned against the fresh `manifest.json`.
