#!/usr/bin/env python3
"""Copy generated story audio from audio-out/ to public/audio/ for dev serving."""
import shutil, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "audio-out" / "zh"
DEST = REPO / "public" / "audio" / "zh"

if not SRC.exists():
    print(f"Source not found: {SRC}")
    sys.exit(1)

if DEST.exists():
    shutil.rmtree(DEST)

shutil.copytree(SRC, DEST)
count = sum(1 for _ in DEST.rglob("*.mp3")) + sum(1 for _ in DEST.rglob("*.json"))
print(f"Copied {count} files from audio-out/zh → public/audio/zh")
