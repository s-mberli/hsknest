#!/usr/bin/env python3
"""
Offline generator for HSKNest's natural Mandarin audio.

Reads the same seed JSON the app seeds from, dedupes every word `term` and
sentence `text`, synthesizes each once with Kokoro-82M (zh), and writes MP3s
named by a SHA-256 of the exact text — the SAME scheme src/lib/audio.ts uses to
find them at runtime, so no database or API change is needed.

The vocabulary is fixed, so this runs ONCE (re-run only after changing the seed
data). It is resumable: existing files are skipped, so you can stop and restart.

Usage:
    pip install kokoro "misaki[zh]" soundfile      # + ffmpeg on PATH
    python scripts/generate-audio.py               # → ./audio-out/
    python scripts/generate-audio.py --voice zf_xiaoni --out /tmp/audio

Recommended on a Colab GPU (~14k clips in ~15 min); local CPU also works but is
slower. Then copy the tree onto the VPS audio volume — see docs/AUDIO.md.

Filename scheme (must match src/lib/audio.ts):
    words:     <out>/zh/w/<sha256(term)[:20]>.mp3
    sentences: <out>/zh/s/<sha256(text)[:20]>.mp3
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
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


def clip_hash(text: str) -> str:
    """SHA-256 of the UTF-8 text, first 20 hex chars. Mirrors src/lib/audio.ts."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:20]


def collect() -> tuple[list[str], list[str]]:
    """Deduped word terms and sentence texts, preserving first-seen order."""
    words: dict[str, None] = {}
    for path in WORD_FILES:
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
            if text:
                sentences.setdefault(text, None)

    return list(words), list(sentences)


def encode_mp3(samples, sample_rate: int, dest: Path) -> None:
    """Write 24 kHz float samples as a small mono MP3 via ffmpeg."""
    import soundfile as sf

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)
    try:
        sf.write(str(wav_path), samples, sample_rate)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
             "-ac", "1", "-b:a", "48k", str(dest)],
            check=True,
        )
    finally:
        wav_path.unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate HSKNest Mandarin audio.")
    ap.add_argument("--out", default=str(REPO / "audio-out"),
                    help="output dir (default: ./audio-out)")
    ap.add_argument("--voice", default="zf_xiaoxiao",
                    help="Kokoro zh voice id (default: zf_xiaoxiao)")
    ap.add_argument("--limit", type=int, default=0,
                    help="cap number of NEW clips this run (0 = all; for a smoke test)")
    args = ap.parse_args()

    out = Path(args.out)
    words, sentences = collect()
    print(f"{len(words)} unique words, {len(sentences)} sentences", flush=True)

    # Import here so `collect()` and hashing work without the heavy deps
    # (e.g. to eyeball counts before installing Kokoro).
    from kokoro import KPipeline  # type: ignore

    pipeline = KPipeline(lang_code="z")  # 'z' = Mandarin in Kokoro
    made = skipped = 0

    def synth(text: str) -> None:
        nonlocal made
        # Kokoro yields (graphemes, phonemes, audio) chunks; a word/short
        # sentence is one chunk. Concatenate defensively for longer inputs.
        import numpy as np

        chunks = [audio for _, _, audio in pipeline(text, voice=args.voice)]
        if not chunks:
            raise RuntimeError("empty synthesis")
        samples = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
        return samples

    for kind_dir, items in (("w", words), ("s", sentences)):
        for text in items:
            dest = out / "zh" / kind_dir / f"{clip_hash(text)}.mp3"
            if dest.exists():
                skipped += 1
                continue
            if args.limit and made >= args.limit:
                break
            try:
                samples = synth(text)
                encode_mp3(samples, 24000, dest)
                made += 1
                if made % 100 == 0:
                    print(f"  {made} generated…", flush=True)
            except Exception as exc:  # noqa: BLE001 — log and continue
                print(f"  ! failed {text!r}: {exc}", file=sys.stderr, flush=True)

    # Coverage manifest: every expected hash, so we can diff against the volume.
    manifest = out / "manifest.json"
    manifest.write_text(
        json.dumps({
            "voice": args.voice,
            "words": [clip_hash(t) for t in words],
            "sentences": [clip_hash(t) for t in sentences],
        }),
        encoding="utf-8",
    )

    print(f"done — {made} generated, {skipped} already present", flush=True)
    print(f"output: {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
