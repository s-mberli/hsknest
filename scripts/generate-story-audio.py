#!/usr/bin/env python3
"""
Offline audio generator for Reading Mode stories (edge-tts).

For every story under content/reading/**\/*.md, synthesizes whole-text
narration with Microsoft Edge's free TTS (same engine as
scripts/generate-audio.py, no API key) AND captures WordBoundary events,
reconciling them to character offsets in the story body. Output per story:

    audio-out/zh/r/<slug>.mp3              whole-text narration
    audio-out/zh/r/<slug>.timings.json     {v, voice, durationMs, textHash, marks:[{s,e,t0,t1}]}

marks are char spans (s,e) into the story body with millisecond spans
(t0,t1) — the client's karaoke loop maps hydrated tokens to marks by offset
containment. No boundary events are needed at runtime.

Resumable: existing MP3s are skipped unless --force.

Usage:
    pip install edge-tts
    python scripts/generate-story-audio.py                 # all stories
    python scripts/generate-story-audio.py --force          # regenerate
    python scripts/generate-story-audio.py --voice zh-CN-YunxiNeural
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONTENT = REPO / "content" / "reading"
OUT_DEFAULT = REPO / "audio-out"

DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
CONCURRENCY = 4
MAX_RETRIES = 5

FRONTMATTER = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", re.S)
FM_KEY = re.compile(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", re.M)

# Spoken-token cleaning: keep CJK and alphanumerics (boundary texts arrive
# without whitespace; punctuation may or may not ride along).
CLEAN = re.compile(r"[^\w\u3400-\u9fff\uf900-\ufaff]+")


def parse_story(file: Path) -> tuple[dict[str, str], str] | None:
    raw = file.read_text(encoding="utf-8")
    m = FRONTMATTER.match(raw)
    if not m:
        return None
    fm = {k: v.strip() for k, v in FM_KEY.findall(m.group(1))}
    return fm, m.group(2).strip()


def slug_for(file: Path, fm: dict[str, str]) -> str:
    if fm.get("slug"):
        return fm["slug"]
    return f"{file.parent.name}-{file.stem}"


def collect() -> list[tuple[str, str]]:
    """[(slug, body)] for every story file."""
    out: list[tuple[str, str]] = []
    if not CONTENT.exists():
        return out
    for file in sorted(CONTENT.rglob("*.md")):
        parsed = parse_story(file)
        if not parsed:
            print(f"  ! {file.name}: no frontmatter, skipped", file=sys.stderr)
            continue
        fm, body = parsed
        out.append((slug_for(file, fm), body))
    return out


def reconcile(body: str, boundaries: list[dict]) -> list[dict]:
    """
    Map TTS WordBoundary chunks to char spans in `body`.

    Boundary `text` values concatenated cover the spoken words (punctuation
    is dropped or attached). Walk a pointer: for each boundary, strip
    non-word chars and locate the remainder in the body from the pointer;
    advance. Unlocatable boundaries extend the previous mark's end time so
    playback never stalls on a gap.
    """
    marks: list[dict] = []
    ptr = 0
    for b in boundaries:
        t0 = b["offset"] / 1e4  # 100ns ticks -> ms
        t1 = (b["offset"] + b["duration"]) / 1e4
        spoken = CLEAN.sub("", b.get("text", ""))
        if not spoken:
            if marks:
                marks[-1]["t1"] = t1
            continue
        idx = body.find(spoken, ptr)
        if idx < 0:
            # tolerated mismatch (TTS number normalization etc.) — ride along
            if marks:
                marks[-1]["t1"] = t1
            continue
        marks.append({"s": idx, "e": idx + len(spoken), "t0": t0, "t1": t1})
        ptr = idx + len(spoken)
    return marks


async def synth(slug: str, body: str, out_dir: Path, voice: str, sem: asyncio.Semaphore) -> str:
    import edge_tts

    mp3 = out_dir / f"{slug}.mp3"
    timings = out_dir / f"{slug}.timings.json"
    out_dir.mkdir(parents=True, exist_ok=True)

    async with sem:
        for attempt in range(MAX_RETRIES):
            try:
                communicate = edge_tts.Communicate(body, voice, boundary="WordBoundary")
                audio = bytearray()
                boundaries: list[dict] = []
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio.extend(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        boundaries.append(chunk)

                tmp = out_dir / f"{slug}.mp3.part"
                tmp.write_bytes(bytes(audio))
                tmp.replace(mp3)

                last_end = boundaries[-1]["offset"] + boundaries[-1]["duration"] if boundaries else 0
                payload = {
                    "v": 1,
                    "voice": voice,
                    "durationMs": last_end / 1e4,
                    "marks": reconcile(body, boundaries),
                    # Lets the reader detect timings generated against an older
                    # revision of the story: marks are char offsets into `body`,
                    # so editing the text silently desyncs the karaoke
                    # highlight. Must match hashStoryText() in
                    # src/lib/reading/storyAudio.ts (sha256, first 20 hex) —
                    # including the CRLF->LF normalize: `body` here already
                    # went through Path.read_text()'s universal-newline
                    # translation, but that's an implicit property of how
                    # `collect()` reads files, not visible at this call site.
                    # Normalizing explicitly here means this line stays
                    # correct even if the read path changes.
                    "textHash": hashlib.sha256(body.replace("\r\n", "\n").encode("utf-8")).hexdigest()[:20],
                }
                timings.write_text(
                    json.dumps(payload, ensure_ascii=False), encoding="utf-8"
                )
                return "made"
            except Exception as exc:  # noqa: BLE001 — retry then give up
                if attempt == MAX_RETRIES - 1:
                    print(f"  ! {slug}: {exc}", file=sys.stderr, flush=True)
                    return "fail"
                await asyncio.sleep(2**attempt)
    return "fail"


async def run(out: Path, voice: str, force: bool) -> None:
    stories = collect()
    print(f"{len(stories)} stories found", flush=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    made = skipped = failed = 0
    tasks = []
    for slug, body in stories:
        mp3 = out / "zh" / "r" / f"{slug}.mp3"
        if mp3.exists() and not force:
            skipped += 1
            continue
        tasks.append(synth(slug, body, out / "zh" / "r", voice, sem))
    for coro in asyncio.as_completed(tasks):
        status = await coro
        if status == "made":
            made += 1
        elif status == "fail":
            failed += 1

    print(f"done — {made} generated, {skipped} skipped, {failed} failed", flush=True)
    print(f"output: {out / 'zh' / 'r'}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate Reading Mode narration audio (edge-tts).")
    ap.add_argument("--out", default=str(OUT_DEFAULT), help="output dir (default ./audio-out)")
    ap.add_argument("--voice", default=DEFAULT_VOICE, help=f"edge-tts voice (default {DEFAULT_VOICE})")
    ap.add_argument("--force", action="store_true", help="regenerate existing files")
    args = ap.parse_args()
    asyncio.run(run(Path(args.out), args.voice, args.force))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
