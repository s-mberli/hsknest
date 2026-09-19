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
    (word.phonetic
      ? normalizePronunciation(word.phonetic).includes(
          normalizePronunciation(query, true)
        )
      : false) ||
    word.translation.toLowerCase().includes(needle) ||
    parseMeanings(word).some((m) => m.gloss.toLowerCase().includes(needle))
  );
}

const PINYIN_BASES: Record<string, string> = {
  "ā": "a",
  "á": "a",
  "ǎ": "a",
  "à": "a",
  "ē": "e",
  "é": "e",
  "ě": "e",
  "è": "e",
  "ī": "i",
  "í": "i",
  "ǐ": "i",
  "ì": "i",
  "ō": "o",
  "ó": "o",
  "ǒ": "o",
  "ò": "o",
  "ū": "u",
  "ú": "u",
  "ǔ": "u",
  "ù": "u",
  "ǖ": "ü",
  "ǘ": "ü",
  "ǚ": "ü",
  "ǜ": "ü",
};

/** Normalize only the pronunciation comparison; ordinary text search stays literal. */
export function normalizePronunciation(value: string, isQuery = false): string {
  let normalized = value.toLocaleLowerCase().replace(/[\s']/g, "");
  normalized = normalized.replace(
    /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g,
    (character) => PINYIN_BASES[character] ?? character
  );
  if (isQuery) {
    normalized = normalized.replace(/u:/g, "ü").replace(/v/g, "ü");
  }
  return normalized;
}

export function relativeDueLabel(
  dueAt: Date | string | null,
  prefix?: "due in" | "in",
  now = Date.now()
): string {
  if (!dueAt) return prefix === "in" ? "\u2014" : "not scheduled";
  const due = typeof dueAt === "string" ? new Date(dueAt).getTime() : dueAt.getTime();
  if (Number.isNaN(due)) return prefix === "in" ? "\u2014" : "not scheduled";
  const compact = prefix === "in";
  if (due < now) return compact ? "overdue" : "Overdue";
  if (due === now) return compact ? "now" : "Due now";

  const dueDate = new Date(due);
  const nowDate = new Date(now);
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (dayKey(dueDate) === dayKey(nowDate)) return compact ? "today" : "Today";

  const tomorrow = new Date(nowDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey(dueDate) === dayKey(tomorrow)) {
    return compact ? "tomorrow" : "Tomorrow";
  }

  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dueDate);
  return compact ? `on ${date}` : date;
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
    label: "All due now",
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
