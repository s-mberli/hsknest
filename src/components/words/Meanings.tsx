"use client";

import { useState } from "react";

import { parseMeanings } from "@/lib/meanings";

/** Minimal word shape `Meanings` needs — satisfied by WordDetail and WordRow. */
type MeaningsWord = {
  translation: string;
  metadata?: unknown;
  phonetic?: string | null;
};

/**
 * All senses, up to 5 by default; "+N more" expands the rest in place so the
 * indicator is an affordance, not a dead end.
 */
export function Meanings({ word }: { word: MeaningsWord }) {
  const [expanded, setExpanded] = useState(false);
  const meanings = parseMeanings(word);
  const shown = expanded ? meanings : meanings.slice(0, 5);
  const hidden = meanings.length - shown.length;

  if (meanings.length <= 1) {
    return <p className="mt-0.5 text-sm">{meanings[0]?.gloss ?? word.translation}</p>;
  }
  return (
    <ol className="mt-0.5 space-y-0.5 text-sm">
      {shown.map((m, i) => (
        <li key={i}>
          <span className="mr-1 tabular-nums text-muted-foreground/60">
            {i + 1}.
          </span>
          {m.reading && m.reading !== word.phonetic && (
            <span className="mr-1 rounded bg-muted px-1 text-xs text-muted-foreground">
              {m.reading}
            </span>
          )}
          {m.gloss}
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            +{hidden} more {hidden === 1 ? "meaning" : "meanings"}
          </button>
        </li>
      )}
    </ol>
  );
}
