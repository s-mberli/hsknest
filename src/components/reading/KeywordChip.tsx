"use client";

import { useState } from "react";

import { WordInfoCard } from "./WordInfoCard";

interface KeywordProps {
  word: string;
  py: string | null;
  lvl: number | null;
  senses: { pinyin: string; meanings: string[] }[] | null;
}

export function KeywordChip({ word, py, lvl, senses }: KeywordProps) {
  const [open, setOpen] = useState(false);
  const meanings = senses?.flatMap(s => s.meanings.slice(0, 3)).filter(Boolean) ?? [];
  return (
    <span className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="rounded-lg bg-muted px-2.5 py-1 text-sm hover:bg-accent transition-colors text-left font-medium">{word}</button>
      {open && (
        <WordInfoCard
          placement="popover"
          term={word}
          pinyin={py}
          level={lvl}
          meanings={meanings}
          role="dialog"
          aria-label={`${word} definition`}
          className="absolute bottom-full left-0 mb-1 z-20"
          footer={<button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground">close</button>}
        />
      )}
    </span>
  );
}
