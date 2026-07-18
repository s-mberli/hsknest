"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { parseMeanings } from "@/lib/meanings";
import { packCircles, packedHeight } from "@/lib/pack";
import {
  STRENGTH_META,
  STRENGTH_ORDER,
  type Strength,
} from "@/lib/strength";
import { type WordDetail, WordHoverCard } from "@/components/words/WordHoverCard";
import { TILE, WordTile } from "@/components/words/WordTile";
import { usePrefersReducedMotion } from "@/lib/motion";

/** Legend swatches — five buckets ("shaky" folds into the Trouble marker). */
const LEGEND: { label: string; band: Strength; extra?: string }[] = [
  { label: "New", band: "new" },
  { label: "Learning", band: "growing" },
  { label: "Solid", band: "solid" },
  { label: "Mastered", band: "mastered" },
  { label: "Trouble", band: "shaky", extra: "relative" },
];

/** Bubble radius bounds (px): min keeps a 44px touch target, max caps depth. */
const MIN_R = 22;
const MAX_R = 56;
/** Above this many visible words, cap bubbles + add per-band summary bubbles. */
const BUBBLE_CAP = 150;
/** Above this many bubbles, skip enter animation for perf. */
const MOTION_PERF_GUARD = 400;

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

/** sqrt-scaled interval → bubble radius, clamped so terms stay legible. */
function bubbleRadius(intervalDays: number | null): number {
  const interval =
    intervalDays != null && Number.isFinite(intervalDays) && intervalDays > 0
      ? intervalDays
      : 0;
  // sqrt scale: 0d → MIN_R, ~365d → MAX_R.
  const r = MIN_R + Math.sqrt(interval) * ((MAX_R - MIN_R) / Math.sqrt(365));
  return Math.max(MIN_R, Math.min(MAX_R, r));
}

interface WordStrengthGridProps {
  words: WordDetail[];
  search?: string;
  /** Limit to these bands (e.g. when a filter is active). */
  bands?: Strength[];
  emptyLabel?: string;
}

/**
 * Strength view: a bubble-cloud where bubble size = memory depth
 * (sqrt of intervalDays) and fill = strength band on the primary-hue ramp.
 * Above BUBBLE_CAP visible words it degrades to the deepest N + per-band
 * "+N more" summary bubbles, with the classic tile grid one toggle away.
 */
export function WordStrengthGrid({
  words,
  search = "",
  bands,
  emptyLabel = "No words to show.",
}: WordStrengthGridProps) {
  const allowed = bands ? new Set(bands) : null;
  const [asGrid, setAsGrid] = useState(false);

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

  // Capping only kicks in above BUBBLE_CAP; below it the bubble view already
  // shows every word, so the grid escape hatch would be redundant.
  const capped = sorted.length > BUBBLE_CAP;
  const showGrid = capped && asGrid;

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
        {capped && (
          <button
            type="button"
            onClick={() => setAsGrid((v) => !v)}
            className="ml-auto rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {asGrid ? "Show as bubbles" : "Show all as grid"}
          </button>
        )}
      </div>

      {showGrid ? (
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
      ) : (
        <BubbleCloud words={sorted} />
      )}
    </div>
  );
}

type Bubble =
  | { kind: "word"; word: WordDetail; r: number }
  | { kind: "summary"; band: Strength; count: number; r: number };

function BubbleCloud({ words }: { words: WordDetail[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard/visual order = size desc (deepest memories first).
  const bubbles = useMemo<Bubble[]>(() => {
    const bySize = [...words].sort(
      (a, b) => (b.intervalDays ?? 0) - (a.intervalDays ?? 0)
    );
    if (bySize.length <= BUBBLE_CAP) {
      return bySize.map((w) => ({
        kind: "word",
        word: w,
        r: bubbleRadius(w.intervalDays),
      }));
    }
    // Scale guard: deepest N as bubbles, rest folded into per-band summaries.
    const shown = bySize.slice(0, BUBBLE_CAP);
    const rest = bySize.slice(BUBBLE_CAP);
    const restByBand = new Map<Strength, number>();
    for (const w of rest) {
      restByBand.set(w.strength, (restByBand.get(w.strength) ?? 0) + 1);
    }
    const out: Bubble[] = shown.map((w) => ({
      kind: "word",
      word: w,
      r: bubbleRadius(w.intervalDays),
    }));
    for (const band of STRENGTH_ORDER) {
      const count = restByBand.get(band);
      if (count) out.push({ kind: "summary", band, count, r: MIN_R + 6 });
    }
    return out;
  }, [words]);

  const packed = useMemo(
    () => (width > 0 ? packCircles(bubbles.map((b) => b.r), width) : []),
    [bubbles, width]
  );

  const height = useMemo(() => packedHeight(packed), [packed]);
  const animate = !reducedMotion && bubbles.length <= MOTION_PERF_GUARD;

  // Word bubbles precede summary bubbles, so only indices < wordCount have
  // focusable triggers. Prune stale refs when filters shrink the set so
  // End/arrow keys never land on a dead ref.
  const wordCount = useMemo(
    () => bubbles.filter((b) => b.kind === "word").length,
    [bubbles]
  );
  useEffect(() => {
    bubbleRefs.current.length = wordCount;
  }, [wordCount]);

  function focusBubble(index: number) {
    const clamped = Math.max(0, Math.min(wordCount - 1, index));
    bubbleRefs.current[clamped]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusBubble(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusBubble(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusBubble(0);
        break;
      case "End":
        e.preventDefault();
        focusBubble(wordCount - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      {width > 0 &&
        bubbles.map((b, i) => {
          const pos = packed[i];
          if (!pos) return null;
          const style: React.CSSProperties = {
            position: "absolute",
            left: pos.x - pos.r,
            top: pos.y - pos.r,
            width: pos.r * 2,
            height: pos.r * 2,
          };

          if (b.kind === "summary") {
            return (
              <div
                key={`summary-${b.band}`}
                style={style}
                className="flex items-center justify-center rounded-full border border-dashed bg-muted/50 text-center text-[11px] leading-tight text-muted-foreground"
                title={`${b.count} more ${STRENGTH_META[b.band].label} words — use "Show all as grid" to see them`}
              >
                +{b.count}
                <span className="sr-only">
                  {" "}
                  more {STRENGTH_META[b.band].label} words
                </span>
              </div>
            );
          }

          const w = b.word;
          const meta = STRENGTH_META[w.strength];
          // Always show the term — new words sit at MIN_R (22) and used to
          // hide glyphs until hover (r >= 26). Scale type with radius instead.
          const termClass =
            pos.r >= 36
              ? "text-sm"
              : pos.r >= 28
                ? "text-xs"
                : "text-[10px] leading-tight";
          return (
            <motion.div
              key={w.wordId}
              style={style}
              initial={animate ? { opacity: 0, scale: 0.6 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.2,
                delay: animate ? Math.min(i, 10) * 0.015 : 0,
              }}
            >
              <WordHoverCard
                word={w}
                wrapperClassName="block size-full"
                ariaLabel={`${w.term}, ${meta.label}, ${relativeDueLabel(w.dueAt)}`}
                tabIndex={i === 0 ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, i)}
                triggerRef={(el) => {
                  bubbleRefs.current[i] = el;
                }}
                className={cn(
                  "relative flex size-full items-center justify-center rounded-full border leading-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  termClass,
                  TILE[w.strength]
                )}
              >
                <span className="max-w-[85%] truncate px-0.5">{w.term}</span>
                {w.strength === "shaky" && (
                  <span
                    aria-hidden
                    className="absolute right-[12%] top-[12%] size-1.5 rounded-full bg-destructive"
                  />
                )}
              </WordHoverCard>
            </motion.div>
          );
        })}
    </div>
  );
}
