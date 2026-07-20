"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DUE_STATES, HORIZON_META, HORIZON_ORDER, isDueNow, matches, relativeDueLabel, wordHorizon, type Horizon } from "@/lib/horizon";
import { type WordDetail, WordHoverCard } from "@/components/words/WordHoverCard";
import { WordTile } from "@/components/words/WordTile";
import { usePrefersReducedMotion } from "@/lib/motion";
import { STRENGTH_META, type Strength } from "@/lib/strength";
import { mastery, streak } from "@/lib/wordStats";

/** Above this many visible tiles, skip layout animation for perf (~5000-tile scale). */
const MOTION_PERF_GUARD = 400;

interface WordTimelineProps {
  words: WordDetail[];
  search?: string;
  /** Limit to these strength bands (e.g. when a strength filter is active). */
  bands?: Strength[];
  emptyLabel?: string;
  /** User's mastery threshold (days); defaults inside wordStats when absent. */
  masteryThresholdDays?: number | null;
}

/** Hero "Due now" card + horizontally scrollable "Coming soon" strip. */
function FocusHeader({
  words,
  masteryThresholdDays,
  reducedMotion,
}: {
  words: WordDetail[];
  masteryThresholdDays?: number | null;
  reducedMotion: boolean;
}) {
  const [now] = useState(() => Date.now());

  const { nextDue, upcoming } = useMemo(() => {
    const due = words
      .filter((w) => isDueNow(w, now))
      .sort(
        (a, b) =>
          new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()
      );
    // Only schedulable states — MASTERED/ASSUMED keep a stale dueAt but never
    // resurface, so they must not appear as "coming soon" (matches the lanes).
    const notDue = words
      .filter((w) => DUE_STATES.has(w.state) && !isDueNow(w, now) && w.dueAt)
      .sort(
        (a, b) =>
          new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()
      );
    return { nextDue: due[0] ?? null, upcoming: notDue.slice(0, 8) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  if (!nextDue) {
    const soonest = words
      .filter((w) => DUE_STATES.has(w.state) && w.dueAt)
      .sort(
        (a, b) =>
          new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()
      )[0];
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm font-medium">All caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {soonest
            ? `Next word surfaces ${relativeDueLabel(soonest.dueAt, "in")}.`
            : "Nothing scheduled yet \u2014 enroll a list to begin."}
        </p>
      </div>
    );
  }

  const meta = STRENGTH_META[nextDue.strength];
  const masteryPct = mastery(nextDue, masteryThresholdDays);
  const streakCount = streak(nextDue);

  return (
    <div className="space-y-3">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 500, damping: 34 }
        }
        className="rounded-lg border bg-card p-4"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Due now
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold">{nextDue.term}</span>
          {nextDue.phonetic && (
            <span className="text-base text-muted-foreground">
              {nextDue.phonetic}
            </span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Strength</dt>
            <dd className="font-medium">{meta.label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Next review</dt>
            <dd className="font-medium">now</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Streak</dt>
            <dd className="font-medium tabular-nums">{streakCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Mastery</dt>
            <dd className="font-medium tabular-nums">{masteryPct}%</dd>
          </div>
        </dl>
        <Button asChild size="sm" className="mt-4">
          <a href="/study">Quick review</a>
        </Button>
      </motion.div>

      {upcoming.length > 0 && (
        <section aria-labelledby="coming-soon-heading">
          <h3
            id="coming-soon-heading"
            className="mb-1.5 text-sm font-semibold"
          >
            Coming soon
          </h3>
          <ul
            role="list"
            className="flex snap-x gap-2 overflow-x-auto pb-1"
          >
            {upcoming.map((w, i) => (
              <motion.li
                key={w.wordId}
                initial={reducedMotion ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: reducedMotion ? 0 : i * 0.03 }}
                className="shrink-0 snap-start"
              >
                <WordHoverCard
                  word={w}
                  ariaLabel={`${w.term}, ${STRENGTH_META[w.strength].label}, ${relativeDueLabel(w.dueAt, "in")}`}
                  className={cn(
                    "flex min-h-11 w-28 flex-col items-start gap-0.5 rounded-md border bg-card px-2.5 py-2 text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <span className="max-w-full truncate text-sm font-medium">
                    {w.term}
                  </span>
                  {w.phonetic && (
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      {w.phonetic}
                    </span>
                  )}
                  <span className="mt-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {relativeDueLabel(w.dueAt, "in")}
                  </span>
                </WordHoverCard>
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
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
  masteryThresholdDays,
}: WordTimelineProps) {
  const [now] = useState(() => Date.now());
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
    const buckets = new Map<Horizon, WordDetail[]>();
    for (const h of HORIZON_ORDER) buckets.set(h, []);
    for (const w of filtered) {
      buckets.get(wordHorizon(w, now))!.push(w);
    }
    return HORIZON_ORDER.map((h) => ({ horizon: h, words: buckets.get(h)! }));
  }, [filtered, now]);

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
      <FocusHeader
        words={filtered}
        masteryThresholdDays={masteryThresholdDays}
        reducedMotion={reducedMotion}
      />
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
