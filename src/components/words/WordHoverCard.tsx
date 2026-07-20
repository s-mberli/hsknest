"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2 } from "lucide-react";

import { audioAvailableFor, playAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { relativeDueLabel } from "@/lib/horizon";
import { parseMeanings } from "@/lib/meanings";
import { speechSupported } from "@/lib/speech";
import { HighlightedSentence } from "@/components/study/HighlightedSentence";
import { STRENGTH_META, type Strength } from "@/lib/strength";
import { usePrefersReducedMotion } from "@/lib/motion";

type Sentence = {
  text: string;
  translation: string;
  phonetic: string | null;
  source: string | null;
};
/** Word id → its example sentence (or null when none), fetched once per word. */
const sentenceCache = new Map<string, Sentence | null>();

export interface WordDetail {
  wordId: string;
  term: string;
  phonetic: string | null;
  translation: string;
  metadata?: unknown;
  strength: Strength;
  intervalDays: number | null;
  lapses: number | null;
  dueAt: string | null;
  languageCode: string;
  languageName: string;
  state: string;
  easeFactor: number | null;
  repetitions: number | null;
}

/**
 * Tracks the single currently-open hover card across the page so only one is
 * open at a time. Module-level, no context needed.
 */
let openSetter: ((open: boolean) => void) | null = null;
function claimOpen(setter: (open: boolean) => void) {
  if (openSetter && openSetter !== setter) openSetter(false);
  openSetter = setter;
}
function releaseOpen(setter: (open: boolean) => void) {
  if (openSetter === setter) openSetter = null;
}

function formatInterval(intervalDays: number | null): string {
  if (intervalDays == null) return "—";
  if (intervalDays < 1) return "<1 day";
  const d = Math.round(intervalDays);
  return d === 1 ? "1 day" : `${d} days`;
}

/**
 * All senses, up to 5 by default; "+N more" expands the rest in place so the
 * indicator is an affordance, not a dead end.
 */
function Meanings({ word }: { word: WordDetail }) {
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

interface WordHoverCardProps {
  word: WordDetail;
  children: React.ReactNode;
  className?: string;
  /** Extra classes for the positioning wrapper (e.g. "size-full" for bubbles). */
  wrapperClassName?: string;
  /** Accessible name for the trigger — overrides the visible term text. */
  ariaLabel?: string;
  /** Pass-throughs for roving-tabindex arrow-key navigation across a tile grid. */
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  triggerRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * No-dependency popover. Opens on hover/focus (desktop) and tap-toggle
 * (via the trigger's click). Escape or an outside tap closes it. Only one
 * card is open at a time across the page.
 */
export function WordHoverCard({
  word,
  children,
  className,
  wrapperClassName,
  ariaLabel,
  tabIndex,
  onKeyDown,
  triggerRef,
}: WordHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const [sentence, setSentence] = useState<Sentence | null>(
    sentenceCache.get(word.wordId) ?? null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const meta = STRENGTH_META[word.strength];
  const reducedMotion = usePrefersReducedMotion();

  // Lazy-load one example sentence the first time the card opens; cache it so
  // reopening (or other cards for the same word) is instant. Absent → nothing.
  useEffect(() => {
    if (!open || sentenceCache.has(word.wordId)) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/words/${word.wordId}/sentence`);
        if (!res.ok) return;
        const data: { sentence: Sentence | null } = await res.json();
        sentenceCache.set(word.wordId, data.sentence);
        if (active) setSentence(data.sentence);
      } catch {
        // Best-effort enrichment — silence on failure.
      }
    })();
    return () => {
      active = false;
    };
  }, [open, word.wordId]);

  function show() {
    claimOpen(setOpen);
    setOpen(true);
  }
  function hide() {
    setOpen(false);
    releaseOpen(setOpen);
  }
  function toggle() {
    if (open) hide();
    else show();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") hide();
    }
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        hide();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => () => releaseOpen(setOpen), []);

  // Keep the panel within the viewport: measure its box and nudge it back in
  // from either edge (8px padding). Runs on open and on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open) {
      requestAnimationFrame(() => setShiftX(0));
      return;
    }
    function clamp() {
      const el = panelRef.current;
      if (!el) return;
      const pad = 8;
      const rect = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      let correction = 0;
      if (rect.left < pad) correction = pad - rect.left;
      else if (rect.right > vw - pad) correction = vw - pad - rect.right;
      if (correction !== 0) setShiftX((prev) => prev + correction);
    }
    clamp();
    window.addEventListener("resize", clamp);
    window.addEventListener("scroll", clamp, true);
    return () => {
      window.removeEventListener("resize", clamp);
      window.removeEventListener("scroll", clamp, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-block", wrapperClassName)}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={cn("cursor-default", className)}
      >
        {children}
      </button>

      <AnimatePresence>
      {open && (
        <div
          ref={panelRef}
          style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
          className="absolute left-1/2 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1rem)]"
        >
        <motion.div
          id={panelId}
          role="dialog"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.9, y: -4 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 500, damping: 30 }
          }
          className="rounded-lg border bg-popover p-3 text-left text-popover-foreground shadow-lg"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1 text-lg font-semibold">
              {word.term}
              {(speechSupported() || audioAvailableFor(word.languageCode)) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void playAudio(word.term, "word", word.languageCode);
                  }}
                  aria-label="Play pronunciation"
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Volume2 className="size-4" />
                </button>
              )}
            </span>
            {word.phonetic && (
              <span className="text-sm text-muted-foreground">
                {word.phonetic}
              </span>
            )}
          </div>
          <Meanings word={word} />

          {sentence && (
            <div className="mt-2 border-t pt-2">
              <HighlightedSentence
                text={sentence.text}
                term={word.term}
                className="text-sm text-foreground/90"
              />
              {sentence.phonetic && (
                <p className="mt-0.5 text-xs text-muted-foreground/80">
                  {sentence.phonetic}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sentence.translation}
              </p>
            </div>
          )}

          <div className="mt-2 border-t pt-2">
            <p className="text-xs font-medium">{meta.label}</p>
            <p className="text-xs text-muted-foreground">{meta.blurb}</p>
          </div>

          <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
            <div>
              <dt className="text-muted-foreground">Interval</dt>
              <dd className="font-medium tabular-nums">
                {formatInterval(word.intervalDays)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="font-medium">{relativeDueLabel(word.dueAt, "in")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lapses</dt>
              <dd className="font-medium tabular-nums">
                {word.lapses ?? 0}
              </dd>
            </div>
          </dl>
        </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
