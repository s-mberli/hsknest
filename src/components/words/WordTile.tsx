"use client";

import { cn } from "@/lib/utils";
import { STRENGTH_META, type Strength } from "@/lib/strength";
import { WordHoverCard, type WordDetail } from "@/components/words/WordHoverCard";

/**
 * Single-hue intensity ramp: memory strength read as tile darkness on the
 * primary hue, not six different colors. "known" sits aside on muted; "shaky"
 * (Trouble) keeps its ramp intensity but wears a trouble marker (dot + ring).
 */
export const TILE: Record<Strength, string> = {
  mastered: "bg-primary text-primary-foreground border-transparent",
  solid: "bg-primary/50 border-transparent",
  growing: "bg-primary/15 border-transparent",
  shaky: "bg-primary/15 border-transparent ring-1 ring-destructive/40",
  known: "bg-muted text-muted-foreground border-transparent",
  // Solid fill on cream paper — transparent ghosts looked empty until hover.
  new: "bg-card text-foreground border-border",
};

/** Underline fill fraction per band — the non-color cue for strength. */
const UNDERLINE_FILL: Record<Strength, number> = {
  mastered: 1,
  solid: 0.8,
  growing: 0.5,
  shaky: 0.25,
  known: 0.9,
  new: 0.08,
};

function relativeDueLabel(dueAt: string | null): string {
  if (!dueAt) return "not scheduled";
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return "not scheduled";
  const diffDays = Math.round((due - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return diffDays < 0 ? "overdue" : "due today";
  if (diffDays === 1) return "due in 1 day";
  if (diffDays < 30) return `due in ${diffDays} days`;
  const months = Math.round(diffDays / 30);
  return months === 1 ? "due in 1 month" : `due in ${months} months`;
}

export interface WordTileProps {
  word: WordDetail;
  /** Roving-tabindex plumbing for arrow-key navigation across a tile grid. */
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tileRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * A single word tile: colored by strength band, dual-encoded with a
 * strength-fraction underline (not hue alone), wrapped in the shared
 * WordHoverCard for detail. Reused by both the Strength grid and the
 * Timeline lanes so hover/tap detail is identical across views.
 */
export function WordTile({ word, tabIndex, onKeyDown, tileRef }: WordTileProps) {
  const meta = STRENGTH_META[word.strength];
  const ariaLabel = `${word.term}, ${meta.label}, ${relativeDueLabel(word.dueAt)}`;

  return (
    <WordHoverCard
      word={word}
      ariaLabel={ariaLabel}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      triggerRef={tileRef}
      className={cn(
        "relative flex h-12 w-full flex-col items-center justify-center gap-1 rounded-md border px-1.5 text-sm leading-tight",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        TILE[word.strength]
      )}
    >
      <span className="max-w-full truncate">{word.term}</span>
      <span aria-hidden className="h-[2px] w-3/4 max-w-8 rounded-full bg-current/25">
        <span
          className="block h-full rounded-full bg-current"
          style={{ width: `${UNDERLINE_FILL[word.strength] * 100}%` }}
        />
      </span>
      {word.strength === "shaky" && (
        <span
          aria-hidden
          className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive"
        />
      )}
    </WordHoverCard>
  );
}
