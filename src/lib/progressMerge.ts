/**
 * Shared-progress identity: one progress record per (user, term, language).
 * Word rows stay per-list (content), but enrolling a second list skips terms
 * the user already tracks in that language, and duplicate progress rows from
 * before this rule are merged down to the strongest one.
 */

export interface ProgressStrength {
  intervalDays: number;
  repetitions: number;
  lastReviewedAt: Date | null;
}

/** Normalize a term for identity comparison across lists. */
export function termKey(term: string): string {
  return term.trim().normalize("NFC");
}

/**
 * Pick the strongest of several progress rows for the same term: the one the
 * scheduler has advanced furthest. Order: longest interval, then most
 * repetitions, then most recently reviewed.
 */
export function pickStrongestProgress<T extends ProgressStrength>(
  rows: T[]
): T {
  return rows.reduce((best, row) => {
    if (row.intervalDays !== best.intervalDays) {
      return row.intervalDays > best.intervalDays ? row : best;
    }
    if (row.repetitions !== best.repetitions) {
      return row.repetitions > best.repetitions ? row : best;
    }
    const a = row.lastReviewedAt?.getTime() ?? 0;
    const b = best.lastReviewedAt?.getTime() ?? 0;
    return a > b ? row : best;
  });
}
