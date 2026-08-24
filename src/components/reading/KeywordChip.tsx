"use client";

import { useState } from "react";

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
        <div className="absolute bottom-full left-0 mb-1 z-20 rounded-lg border bg-card p-3 shadow-lg w-56">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold">{word}</span>
            {py && <span className="text-xs text-muted-foreground">{py}</span>}
            {lvl && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">HSK {lvl}</span>}
          </div>
          {meanings.length > 0 ? (
            <div className="space-y-0.5">{meanings.map((m, i) => <p key={i} className="text-xs text-muted-foreground">{m}</p>)}</div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No dictionary entry</p>
          )}
          <button onClick={() => setOpen(false)} className="mt-1 text-[10px] text-muted-foreground hover:text-foreground">close</button>
        </div>
      )}
    </span>
  );
}
