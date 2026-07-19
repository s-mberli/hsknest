/**
 * Memory-horizon bucketing — a display-oriented view over raw SRS state,
 * grouping words by *when* they next surface rather than how well they're
 * known. Pure/derivation only: no I/O, no Prisma types.
 */

import { parseMeanings } from "./meanings";

export function matches(
  word: { term: string; translation: string; phonetic: string | null; metadata?: unknown },
  query: string
): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    word.term.toLowerCase().includes(needle) ||
    (word.phonetic?.toLowerCase().includes(needle) ?? false) ||
    word.translation.toLowerCase().includes(needle) ||
    parseMeanings(word).some((m) => m.gloss.toLowerCase().includes(needle))
  );
}

export function relativeDueLabel(
  dueAt: Date | string | null,
  prefix?: "due in" | "in"
): string {
  if (!dueAt) return prefix === "in" ? "\u2014" : "not scheduled";
  const due = typeof dueAt === "string" ? new Date(dueAt).getTime() : dueAt.getTime();
  if (Number.isNaN(due)) return prefix === "in" ? "\u2014" : "not scheduled";
  const diffDays = Math.round((due - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return diffDays < 0 ? "overdue" : "due today";
  const pfx = prefix ?? "due in";
  if (diffDays === 1) return `${pfx} 1 day`;
  if (diffDays < 30) return `${pfx} ${diffDays} days`;
  const months = Math.round(diffDays / 30);
  return months === 1 ? `${pfx} 1 month` : `${pfx} ${months} months`;
}

export type Horizon = "due" | "week" | "month" | "later" | "new" | "resting";

export interface HorizonInput {
  state: string;
  dueAt: string | null;
}

/** States that can be due for review right now (excludes NEW/ASSUMED/MASTERED). */
export const DUE_STATES = new Set(["LEARNING", "REVIEW", "LAPSED"]);

/** True when a word is due for review as of `now`. */
export function isDueNow(w: HorizonInput, now: number): boolean {
  if (!DUE_STATES.has(w.state)) return false;
  if (!w.dueAt) return false;
  const due = new Date(w.dueAt).getTime();
  return !Number.isNaN(due) && due <= now;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bucket a word into a horizon lane.
 *
 * - ASSUMED | MASTERED           → resting (set aside as known/mastered)
 * - NEW                          → new (not started)
 * - else (LEARNING/REVIEW/LAPSED), by `dueAt - now`:
 *   - missing/NaN dueAt          → due (surface anomalies, don't hide)
 *   - <= 0                       → due
 *   - <= 7 days                  → week
 *   - <= 30 days                 → month
 *   - > 30 days                  → later
 */
export function wordHorizon(w: HorizonInput, now: number): Horizon {
  if (w.state === "ASSUMED" || w.state === "MASTERED") return "resting";
  if (w.state === "NEW") return "new";

  if (!w.dueAt) return "due";
  const due = new Date(w.dueAt).getTime();
  if (Number.isNaN(due)) return "due";

  const diffDays = (due - now) / DAY_MS;
  if (diffDays <= 0) return "due";
  if (diffDays <= 7) return "week";
  if (diffDays <= 30) return "month";
  return "later";
}

/** Stable display order for horizon lanes. */
export const HORIZON_ORDER: Horizon[] = [
  "due",
  "week",
  "month",
  "later",
  "new",
  "resting",
];

/** Display copy per lane. */
export const HORIZON_META: Record<Horizon, { label: string; sublabel: string }> = {
  due: {
    label: "Due now",
    sublabel: "Ready for review — practice these to keep them.",
  },
  week: {
    label: "This week",
    sublabel: "Coming back within 7 days.",
  },
  month: {
    label: "This month",
    sublabel: "Resurfacing in the next few weeks.",
  },
  later: {
    label: "Long-term memory",
    sublabel: "Settled deep — not due for a month or more.",
  },
  new: {
    label: "Not started",
    sublabel: "In your lists, not yet studied.",
  },
  resting: {
    label: "Resting",
    sublabel: "Set aside as known or fully mastered.",
  },
};
