"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { parseMeanings } from "@/lib/meanings";
import { HORIZON_META, HORIZON_ORDER, wordHorizon, type Horizon } from "@/lib/horizon";
import { type WordDetail } from "@/components/words/WordHoverCard";
import { WordTile } from "@/components/words/WordTile";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { Strength } from "@/lib/strength";

/** Above this many visible tiles, skip layout animation for perf (~5000-tile scale). */
const MOTION_PERF_GUARD = 400;

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

interface WordTimelineProps {
  words: WordDetail[];
  search?: string;
  /** Limit to these strength bands (e.g. when a strength filter is active). */
  bands?: Strength[];
  emptyLabel?: string;
}

/**
 * Primary Words-tab view: words arranged in labeled horizon lanes by when
 * they next surface (due now → this week → this month → long-term → not
 * started → resting). Strength and Table remain available as toggles —
 * this view reshapes, it doesn't remove, anything.
 */
export function WordTimeline({
  words,
  search = "",
  bands,
  emptyLabel = "No words to show.",
}: WordTimelineProps) {
  const reducedMotion = usePrefersReducedMotion();
  const allowed = bands ? new Set(bands) : null;

  const filtered = useMemo(
    () =>
      words.filter(
        (w) => matches(w, search) && (!allowed || allowed.has(w.strength))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, search, bands]
  );

  const lanes = useMemo(() => {
    const now = Date.now();
    const buckets = new Map<Horizon, WordDetail[]>();
    for (const h of HORIZON_ORDER) buckets.set(h, []);
    for (const w of filtered) {
      buckets.get(wordHorizon(w, now))!.push(w);
    }
    return HORIZON_ORDER.map((h) => ({ horizon: h, words: buckets.get(h)! }));
  }, [filtered]);

  const animateLayout = !reducedMotion && filtered.length <= MOTION_PERF_GUARD;

  if (filtered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {lanes.map((lane) => (
        <Lane
          key={lane.horizon}
          horizon={lane.horizon}
          words={lane.words}
          animateLayout={animateLayout}
        />
      ))}
    </div>
  );
}

function Lane({
  horizon,
  words,
  animateLayout,
}: {
  horizon: Horizon;
  words: WordDetail[];
  animateLayout: boolean;
}) {
  const meta = HORIZON_META[horizon];
  const headingId = `horizon-${horizon}-heading`;
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (words.length === 0) {
    // Empty lanes collapse to a thin muted rule rather than six empty boxes.
    return (
      <div
        aria-hidden
        className="flex items-center gap-2 text-xs text-muted-foreground/50"
      >
        <span>{meta.label}</span>
        <span className="h-px flex-1 bg-border" />
        <span>0</span>
      </div>
    );
  }

  function focusTile(index: number) {
    const clamped = Math.max(0, Math.min(words.length - 1, index));
    tileRefs.current[clamped]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const cols = Math.max(
      1,
      Math.floor(
        (e.currentTarget.closest("ul")?.clientWidth ?? 0) /
          (e.currentTarget.offsetWidth || 64)
      )
    );
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusTile(index + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusTile(index - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        focusTile(index + cols);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusTile(index - cols);
        break;
      case "Home":
        e.preventDefault();
        focusTile(0);
        break;
      case "End":
        e.preventDefault();
        focusTile(words.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <section aria-labelledby={headingId} style={{ contentVisibility: "auto" }}>
      <h3 id={headingId} className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-semibold">{meta.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {words.length}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {meta.sublabel}
        </span>
      </h3>
      <ul
        role="list"
        className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5"
      >
        <AnimatePresence initial={false}>
          {words.map((w, i) => (
            <motion.li
              key={w.wordId}
              layout={animateLayout ? "position" : false}
              initial={animateLayout ? { opacity: 0, scale: 0.9 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={animateLayout ? { opacity: 0, scale: 0.9 } : undefined}
              transition={{ duration: 0.2, delay: animateLayout ? Math.min(i, 8) * 0.02 : 0 }}
              className="min-w-0"
            >
              <WordTile
                word={w}
                tabIndex={i === 0 ? 0 : -1}
                tileRef={(el) => {
                  tileRefs.current[i] = el;
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
