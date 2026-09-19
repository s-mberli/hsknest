"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { matches, relativeDueLabel } from "@/lib/horizon";
import { primaryGloss } from "@/lib/meanings";
import {
  STRENGTH_META,
  STRENGTH_ORDER,
  type Strength,
} from "@/lib/strength";
import { type WordDetail, WordHoverCard } from "@/components/words/WordHoverCard";

/** Small colored dot matching TILE band intensity, for the row's strength cue. */
const DOT: Record<Strength, string> = {
  mastered: "bg-primary",
  solid: "bg-primary/50",
  growing: "bg-primary/25",
  shaky: "bg-amber",
  known: "bg-muted-foreground/50",
  new: "bg-border",
};

interface WordRetentionListProps {
  words: WordDetail[];
  search?: string;
  bands?: Strength[];
  emptyLabel?: string;
  now: number;
}

/**
 * Dense word list with strength cue, term/phonetic/translation, and due
 * information. The list intentionally reports scheduling facts only; it does
 * not estimate recall probability.
 */
export function WordRetentionList({
  words,
  search = "",
  bands,
  emptyLabel = "No words to show.",
  now,
}: WordRetentionListProps) {
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
    <ul role="list" className="divide-y rounded-lg border">
      {sorted.map((w) => {
        const meta = STRENGTH_META[w.strength];
        const dueLabel =
          w.state === "NEW" ? "New" : relativeDueLabel(w.dueAt, undefined, now);
        const ariaLabel = `${w.term}, ${meta.label}, ${dueLabel}`;
        return (
          <li
            key={w.wordId}
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: "auto 72px",
            }}
          >
            <WordHoverCard
              word={w}
              now={now}
              ariaLabel={ariaLabel}
              wrapperClassName="block w-full"
              className={cn(
                "flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left sm:items-center sm:gap-3",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              )}
            >
              <span
                aria-hidden
                className={cn("mt-2.5 size-2.5 shrink-0 rounded-full sm:mt-0", DOT[w.strength])}
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span data-term className="max-w-full break-words text-lg font-medium">
                    {w.term}
                  </span>
                  {w.phonetic && (
                    <span className="max-w-full break-words text-sm text-muted-foreground">
                      {w.phonetic}
                    </span>
                  )}
                </span>
                <span className="block break-words text-sm text-muted-foreground">
                  {primaryGloss(w)}
                </span>
              </span>
              <span className="max-w-[6.5rem] shrink-0 text-right text-xs leading-4 tabular-nums text-muted-foreground">
                {dueLabel}
              </span>
            </WordHoverCard>
          </li>
        );
      })}
    </ul>
  );
}
