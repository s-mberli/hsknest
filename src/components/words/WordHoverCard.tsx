"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { primaryGloss } from "@/lib/meanings";
import { STRENGTH_META, type Strength } from "@/lib/strength";

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

function relativeDue(dueAt: string | null): string {
  if (!dueAt) return "—";
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return "—";
  const diffMs = due - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return diffDays < 0 ? "overdue" : "due today";
  if (diffDays === 1) return "in 1 day";
  if (diffDays < 30) return `in ${diffDays} days`;
  const months = Math.round(diffDays / 30);
  return months === 1 ? "in 1 month" : `in ${months} months`;
}

function formatInterval(intervalDays: number | null): string {
  if (intervalDays == null) return "—";
  if (intervalDays < 1) return "<1 day";
  const d = Math.round(intervalDays);
  return d === 1 ? "1 day" : `${d} days`;
}

interface WordHoverCardProps {
  word: WordDetail;
  children: React.ReactNode;
  className?: string;
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
}: WordHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const meta = STRENGTH_META[word.strength];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => releaseOpen(setOpen), []);

  // Keep the panel within the viewport: measure its box and nudge it back in
  // from either edge (8px padding). Runs on open and on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open) {
      setShiftX(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        className={cn("cursor-default", className)}
      >
        {children}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
          className="absolute left-1/2 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-lg border bg-popover p-3 text-left text-popover-foreground shadow-lg"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-semibold">{word.term}</span>
            {word.phonetic && (
              <span className="text-sm text-muted-foreground">
                {word.phonetic}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm">{primaryGloss(word)}</p>

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
              <dd className="font-medium">{relativeDue(word.dueAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lapses</dt>
              <dd className="font-medium tabular-nums">
                {word.lapses ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
