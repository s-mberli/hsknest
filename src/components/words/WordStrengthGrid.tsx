"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { parseMeanings } from "@/lib/meanings";
import {
  STRENGTH_META,
  STRENGTH_ORDER,
  type Strength,
} from "@/lib/strength";
import { type WordDetail } from "@/components/words/WordHoverCard";
import { TILE, WordTile } from "@/components/words/WordTile";

/** Legend swatches — five buckets ("shaky" folds into the Trouble marker). */
const LEGEND: { label: string; band: Strength; extra?: string }[] = [
  { label: "New", band: "new" },
  { label: "Learning", band: "growing" },
  { label: "Solid", band: "solid" },
  { label: "Mastered", band: "mastered" },
  { label: "Trouble", band: "shaky", extra: "relative" },
];

function matches(w: WordDetail, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    w.term.toLowerCase().includes(needle) ||
    (w.phonetic?.toLowerCase().includes(needle) ?? false) ||
    w.translation.toLowerCase().includes(needle) ||
    // Also match secondary senses ("three" should find 三 even when its
    // stored translation string leads with another sense).
    parseMeanings(w).some((m) => m.gloss.toLowerCase().includes(needle))
  );
}

interface WordStrengthGridProps {
  words: WordDetail[];
  search?: string;
  /** Limit to these bands (e.g. when a filter is active). */
  bands?: Strength[];
  emptyLabel?: string;
}

export function WordStrengthGrid({
  words,
  search = "",
  bands,
  emptyLabel = "No words to show.",
}: WordStrengthGridProps) {
  const allowed = bands ? new Set(bands) : null;

  const sorted = useMemo(() => {
    const rank = new Map(STRENGTH_ORDER.map((b, i) => [b, i]));
    return words
      .filter((w) => matches(w, search) && (!allowed || allowed.has(w.strength)))
      .sort(
        (a, b) =>
          (rank.get(a.strength) ?? 0) - (rank.get(b.strength) ?? 0) ||
          a.term.localeCompare(b.term)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, search, bands]);

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span
            key={l.label}
            className="flex items-center gap-1.5"
            title={STRENGTH_META[l.band].blurb}
          >
            <span
              aria-hidden
              className={cn(
                "size-3 shrink-0 rounded-sm border",
                TILE[l.band],
                l.extra
              )}
            >
              {l.band === "shaky" && (
                <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-destructive" />
              )}
            </span>
            {l.label}
          </span>
        ))}
      </div>

      <ul
        role="list"
        className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5"
      >
        {sorted.map((w) => (
          <li key={w.wordId} className="min-w-0">
            <WordTile word={w} />
          </li>
        ))}
      </ul>
    </div>
  );
}
