#!/usr/bin/env python3
"""Subset LXGW WenKai to the characters used in HSK 1-3 stories + common CJK punctuation + ASCII."""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "public" / "fonts" / "LXGWWenKai-Regular.ttf"
OUT = REPO / "public" / "fonts" / "LXGWWenKai-Regular-subset.woff2"

def collect_chars():
    chars = set()
    # HSK 1-3 vocab characters
    for lvl in range(1, 8):
        f = REPO / "prisma" / "data" / "hsk" / f"new{lvl}.json"
        if f.exists():
            data = json.loads(f.read_text("utf-8"))
            for row in data:
                for c in row.get("term", ""):
                    chars.add(c)
    # Story body characters
    for md in (REPO / "content" / "reading").rglob("*.md"):
        raw = md.read_text("utf-8")
        if raw.startswith("---"):
            raw = raw.split("---", 2)[-1]
        for c in raw:
            if ord(c) > 0x20:  # skip control chars
                chars.add(c)
    # Common CJK punctuation
    chars.update("，。！？、；：""''（）《》【】…—")
    # ASCII printable
    chars.update(chr(i) for i in range(32, 127))
    # Numbers
    chars.update("0123456789")
    return sorted(chars)

def main():
    if not SRC.exists():
        print(f"Source font not found: {SRC}")
        return 1
    chars = collect_chars()
    print(f"Subsetting to {len(chars)} characters")
    # Write text file for pyftsubset
    txt = REPO / "public" / "fonts" / "_subset_chars.txt"
    txt.write_text("".join(chars), encoding="utf-8")
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options

    print("Loading font...")
    font = TTFont(str(SRC))
    options = Options()
    options.flavor = "woff2"
    subsetter = Subsetter(options=options)
    subsetter.populate(text="".join(chars))
    subsetter.subset(font)
    font.save(str(OUT))
    size = OUT.stat().st_size
    print(f"Subset: {size:,} bytes ({size/1024:.0f}KB)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
