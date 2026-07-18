"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { parseMeanings } from "@/lib/meanings";
import { retentionCurve, retentionNow } from "@/lib/retention";
import {
  STRENGTH_META,
  STRENGTH_ORDER,
  type Strength,
} from "@/lib/strength";
import { type WordDetail, WordHoverCard } from "@/components/words/WordHoverCard";

function matches(w: WordDetail, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    w.term.toLowerCase().includes(needle) ||
    (w.phonetic?.toLowerCase().includes(needle) ?? false) ||
    w.translation.toLowerCase().includes(needle) ||
    parseMeanings(w).some((m) => m.gloss.toLowerCase().includes(needle))
  );
}

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

/** Small colored dot matching TILE band intensity, for the row's strength cue. */
const DOT: Record<Strength, string> = {
  mastered: "bg-primary",
  solid: "bg-primary/50",
  growing: "bg-primary/25",
  shaky: "bg-destructive",
  known: "bg-muted-foreground/50",
  new: "bg-border",
};

const SPARK_W = 80;
const SPARK_H = 24;
const SPARK_POINTS = 12;

function Sparkline({ word, now }: { word: WordDetail; now: number }) {
  const hasInterval =
    word.intervalDays != null && Number.isFinite(word.intervalDays) && word.intervalDays > 0;

  if (!hasInterval) {
    return (
      <svg
        role="img"
        aria-label="no retention projection available"
        width={SPARK_W}
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        className="shrink-0 text-muted-foreground/40"
      >
        <line
          x1={2}
          y1={SPARK_H / 2}
          x2={SPARK_W - 2}
          y2={SPARK_H / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const curve = retentionCurve(word, SPARK_POINTS);
  const pct = retentionNow(word, now);
  const pctLabel = pct == null ? "unknown" : `${Math.round(pct * 100)}%`;

  const stepX = (SPARK_W - 4) / (curve.length - 1);
  const toY = (v: number) => SPARK_H - 2 - v * (SPARK_H - 4);
  const linePoints = curve
    .map((v, i) => `${2 + i * stepX},${toY(v)}`)
    .join(" ");
  const fillPoints = `2,${SPARK_H - 2} ${linePoints} ${SPARK_W - 2},${SPARK_H - 2}`;

  // "Now" dot: fraction of the interval already elapsed, computed directly
  // from dueAt so the dot sits on the polyline for any ease factor. The y
  // value is interpolated along the sampled curve (not raw pct) so a clamped
  // x (overdue words) still lands exactly on the drawn line.
  const dueMs = word.dueAt ? new Date(word.dueAt).getTime() : NaN;
  const interval = word.intervalDays!;
  const elapsedDays = Number.isNaN(dueMs)
    ? 0
    : interval - (dueMs - now) / (24 * 60 * 60 * 1000);
  const elapsedFrac = Math.max(0, Math.min(1, elapsedDays / interval));
  const dotX = 2 + elapsedFrac * (SPARK_W - 4);
  const idx = elapsedFrac * (curve.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(curve.length - 1, lo + 1);
  const dotVal = curve[lo] + (curve[hi] - curve[lo]) * (idx - lo);
  const dotY = toY(dotVal);

  return (
    <svg
      role="img"
      aria-label={`projected retention ${pctLabel}`}
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0 text-primary"
    >
      <polygon points={fillPoints} fill="currentColor" opacity={0.12} stroke="none" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pct != null && (
        <circle cx={dotX} cy={dotY} r={2} fill="currentColor" />
      )}
    </svg>
  );
}

interface WordRetentionListProps {
  words: WordDetail[];
  search?: string;
  bands?: Strength[];
  emptyLabel?: string;
  masteryThresholdDays?: number | null;
}

/**
 * Dense word list with strength chip, term/phonetic/translation, and a
 * projected-retention sparkline + due chip. Replaces the Table view on the
 * Words tab (Lists page keeps the shared WordTable untouched).
 */
export function WordRetentionList({
  words,
  search = "",
  bands,
  emptyLabel = "No words to show.",
}: WordRetentionListProps) {
  const allowed = bands ? new Set(bands) : null;
  const now = Date.now();

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
        const ariaLabel = `${w.term}, ${meta.label}, ${relativeDueLabel(w.dueAt)}`;
        return (
          <li key={w.wordId} style={{ contentVisibility: "auto" }}>
            <WordHoverCard
              word={w}
              ariaLabel={ariaLabel}
              wrapperClassName="block w-full"
              className={cn(
                "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              )}
            >
              <span
                aria-hidden
                className={cn("size-2.5 shrink-0 rounded-full", DOT[w.strength])}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-lg font-medium">{w.term}</span>
                  {w.phonetic && (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {w.phonetic}
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {w.translation}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Sparkline word={w} now={now} />
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {relativeDueLabel(w.dueAt).replace(/^due /, "")}
                </span>
              </span>
            </WordHoverCard>
          </li>
        );
      })}
    </ul>
  );
}
