/**
 * Comprehensible-input matching: "how much of this story do you already
 * know?" — pure functions over ReadingTextWord (per-text unique lemma
 * index, written at ingest, previously unread by any code — see
 * scripts/ingest-story.ts) and the caller's set of known terms (from
 * UserProgress, same source as /api/reading/known-words).
 *
 * No I/O here on purpose — same shape as src/lib/reading/grade.ts — so this
 * stays unit-testable without a DB.
 */
import { termKey } from "@/lib/progressMerge";

/** Ideal comprehension band: below this is frustrating, above is un-stretching. */
export const IDEAL_COVERAGE_MIN = 0.9;
export const IDEAL_COVERAGE_MAX = 0.98;

export interface CoverageResult {
  /** 0..1, or null when the text has no indexed words (nothing to compare). */
  pct: number | null;
  knownCount: number;
  totalCount: number;
}

/** Fraction of a story's distinct lemmas the reader already knows. */
export function computeCoverage(
  storyLemmas: string[],
  knownTermKeys: ReadonlySet<string>
): CoverageResult {
  const totalCount = storyLemmas.length;
  if (totalCount === 0) return { pct: null, knownCount: 0, totalCount: 0 };
  let knownCount = 0;
  for (const lemma of storyLemmas) {
    if (knownTermKeys.has(termKey(lemma))) knownCount++;
  }
  return { pct: knownCount / totalCount, knownCount, totalCount };
}

/** Build the normalized lookup set once per request; reused across texts. */
export function toKnownTermKeys(terms: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const t of terms) set.add(termKey(t));
  return set;
}

export type FitLabel = "too-easy" | "just-right" | "challenging" | "too-hard";

/** Coarse label for the coverage badge. Thresholds match the ideal band above. */
export function fitLabel(pct: number): FitLabel {
  if (pct >= 0.99) return "too-easy";
  if (pct >= IDEAL_COVERAGE_MIN) return "just-right";
  if (pct >= 0.75) return "challenging";
  return "too-hard";
}

export interface FitCandidate {
  id: string;
  pct: number | null;
}

/**
 * Pick the single best-fit candidate from a pool (e.g. all published,
 * unread stories): closest to the ideal band, ties broken by whichever is
 * closest to the band's midpoint. Returns null for an empty or
 * all-uncomputable pool.
 */
export function pickBestFit<T extends FitCandidate>(candidates: T[]): T | null {
  const scored = candidates.filter((c): c is T & { pct: number } => c.pct !== null);
  if (scored.length === 0) return null;

  const mid = (IDEAL_COVERAGE_MIN + IDEAL_COVERAGE_MAX) / 2;
  const distance = (pct: number) => {
    if (pct >= IDEAL_COVERAGE_MIN && pct <= IDEAL_COVERAGE_MAX) return Math.abs(pct - mid);
    return pct < IDEAL_COVERAGE_MIN ? IDEAL_COVERAGE_MIN - pct : pct - IDEAL_COVERAGE_MAX;
  };

  return scored.reduce((best, cur) => (distance(cur.pct) < distance(best.pct) ? cur : best));
}
