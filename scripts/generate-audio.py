#!/usr/bin/env python3
"""
Offline generator for HSKNest's natural Mandarin audio (edge-tts).

Reads the same seed JSON the app seeds from, dedupes every word `term` and
sentence `text`, synthesizes each once with Microsoft Edge's free TTS
(edge-tts — the Azure neural engine, no API key), and writes MP3s named by a
SHA-256 of the exact text — the SAME scheme src/lib/audio.ts uses to find them
at runtime, so no database or API change is needed.

Why edge-tts and not a local model: small local models (e.g. Kokoro-82M)
hallucinate on ultra-short input — a lone character like 个 can come out as a
whole wrong phrase. Azure's neural voices read single characters correctly
(context-aware G2P + a canonical-reading lexicon), the way Google does. It
needs internet ONLY during this one-time batch; the output is plain static
MP3s served entirely from your own server afterwards.

The vocabulary is fixed, so this runs ONCE (re-run only after changing the seed
data). It is resumable: existing files are skipped, so you can stop and restart.

Usage:
    pip install edge-tts                       # that's it — no ffmpeg, no GPU
    python scripts/generate-audio.py           # all words + sentences → ./audio-out/
    python scripts/generate-audio.py --level 1 # HSK1 pilot only (~1k clips)
    python scripts/generate-audio.py --voice zh-CN-YunxiNeural   # male voice
    python scripts/generate-audio.py --limit 20 --out /tmp/smoke # tiny smoke test

Filename scheme (must match src/lib/audio.ts):
    words:     <out>/zh/w/<sha256(term)[:20]>.mp3
    sentences: <out>/zh/s/<sha256(text)[:20]>.mp3
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HSK_DIR = REPO / "prisma" / "data" / "hsk"
ZH_DIR = REPO / "prisma" / "data" / "zh"

# Word decks (field: "term") and the sentence file (field: "text").
WORD_FILES = [
    HSK_DIR / f"new{i}.json" for i in range(1, 8)
] + [HSK_DIR / "freq100.json", HSK_DIR / "freq1000.json"]
WORD_FILES += sorted(ZH_DIR.glob("*.json"))
SENTENCE_FILE = HSK_DIR / "sentences.json"

# Concurrency against Microsoft's free endpoint. Modest — it throttles bulk
# load; the retry wrapper below absorbs the occasional 429/403.
CONCURRENCY = 8
MAX_RETRIES = 5


def clip_hash(text: str) -> str:
    """SHA-256 of the UTF-8 text, first 20 hex chars. Mirrors src/lib/audio.ts."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:20]


def collect(level: int | None) -> tuple[list[str], list[str]]:
    """Deduped word terms and sentence texts, preserving first-seen order.

    When `level` is set (pilot mode), restrict to that HSK level: words from
    new{level}.json only, sentences whose metadata.level == level.
    """
    if level is not None:
        word_files = [HSK_DIR / f"new{level}.json"]
    else:
        word_files = WORD_FILES

    words: dict[str, None] = {}
    for path in word_files:
        if not path.exists():
            continue
        for row in json.loads(path.read_text(encoding="utf-8")):
            term = (row.get("term") or "").strip()
            if term:
                words.setdefault(term, None)

    sentences: dict[str, None] = {}
    if SENTENCE_FILE.exists():
        for row in json.loads(SENTENCE_FILE.read_text(encoding="utf-8")):
            text = (row.get("text") or "").strip()
            if not text:
                continue
            if level is not None and (row.get("metadata") or {}).get("level") != level:
                continue
            sentences.setdefault(text, None)

    return list(words), list(sentences)


async def synth_one(
    text: str, dest: Path, voice: str, sem: asyncio.Semaphore
) -> str:
    """Synthesize `text` to `dest` (MP3) with retry/backoff. Returns a status."""
    import edge_tts

    if dest.exists():
        return "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(MAX_RETRIES):
            try:
                communicate = edge_tts.Communicate(text, voice)
                # Write to a temp name first so an interrupted run never leaves
                # a truncated .mp3 that the resumable skip would treat as done.
                tmp = dest.with_suffix(".mp3.part")
                await communicate.save(str(tmp))
                tmp.replace(dest)
                return "made"
            except Exception as exc:  # noqa: BLE001 — retry then give up
                if attempt == MAX_RETRIES - 1:
                    print(f"  ! failed {text!r}: {exc}", file=sys.stderr, flush=True)
                    return "fail"
                await asyncio.sleep(2 ** attempt)  # 1,2,4,8s backoff
    return "fail"


async def run(out: Path, voice: str, level: int | None, limit: int) -> None:
    words, sentences = collect(level)
    scope = f"HSK{level}" if level is not None else "all levels"
    print(f"{scope}: {len(words)} unique words, {len(sentences)} sentences", flush=True)

    jobs: list[tuple[str, Path]] = []
    for text in words:
        jobs.append((text, out / "zh" / "w" / f"{clip_hash(text)}.mp3"))
    for text in sentences:
        jobs.append((text, out / "zh" / "s" / f"{clip_hash(text)}.mp3"))
    if limit:
        # Cap NEW work (existing files still resolve instantly as skips).
        pending = [(t, d) for t, d in jobs if not d.exists()][:limit]
        jobs = [(t, d) for t, d in jobs if d.exists()] + pending

    sem = asyncio.Semaphore(CONCURRENCY)
    made = skipped = failed = 0
    done = 0
    tasks = [synth_one(text, dest, voice, sem) for text, dest in jobs]
    for coro in asyncio.as_completed(tasks):
        status = await coro
        if status == "made":
            made += 1
        elif status == "skip":
            skipped += 1
        else:
            failed += 1
        done += 1
        if made and done % 100 == 0:
            print(f"  {made} generated, {skipped} skipped…", flush=True)

    # Coverage manifest: every expected hash, so we can diff against the volume.
    (out / "manifest.json").write_text(
        json.dumps({
            "voice": voice,
            "level": level,
            "words": [clip_hash(t) for t in words],
            "sentences": [clip_hash(t) for t in sentences],
        }),
        encoding="utf-8",
    )

    print(
        f"done — {made} generated, {skipped} already present, {failed} failed",
        flush=True,
    )
    print(f"output: {out}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate HSKNest Mandarin audio (edge-tts).")
    ap.add_argument("--out", default=str(REPO / "audio-out"),
                    help="output dir (default: ./audio-out)")
    ap.add_argument("--voice", default="zh-CN-XiaoxiaoNeural",
                    help="edge-tts voice (default: zh-CN-XiaoxiaoNeural, female; "
                         "male: zh-CN-YunxiNeural)")
    ap.add_argument("--level", type=int, default=None,
                    help="pilot: only this HSK level's words + sentences (e.g. 1)")
    ap.add_argument("--limit", type=int, default=0,
                    help="cap number of NEW clips this run (0 = all; for a smoke test)")
    args = ap.parse_args()

    asyncio.run(run(Path(args.out), args.voice, args.level, args.limit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
