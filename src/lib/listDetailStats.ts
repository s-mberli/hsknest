import { DUE_STATES, TRACKED_STATES } from "@/lib/cardStates";
import type { CardState } from "@/lib/srs";

/**
 * Pure stat computation for the list detail page (lists/[id]/page.tsx).
 * Split out — like listSections.ts is for the lists index — so the same
 * canonical due/learned rules can be unit-tested without a DB or React.
 *
 * Previously hand-rolled inline on the page with two bugs: dueCount's
 * predicate counted MASTERED as due (every other surface excludes it via
 * DUE_STATES), and strongPct divided by enrolled-word count instead of the
 * list's total size, so partially-enrolled lists overstated the percentage.
 */

interface ProgressRow {
  state: string;
  dueAt: Date;
}

export interface ListDetailStats {
  /** Cards due right now, canonical DUE_STATES rule (excludes MASTERED/ASSUMED). */
  dueCount: number;
  /** Progress rows in any state other than NEW — same rule the lists index uses. */
  learnedCount: number;
  /** Cards in REVIEW or MASTERED, as a percentage of the list's total words
   *  (not of enrolled words — a partially-enrolled list shouldn't read as
   *  more "solid" just because its enrolled subset is small). */
  strongPct: number;
}

export function computeListDetailStats(
  progress: ProgressRow[],
  wordCount: number,
  now: Date
): ListDetailStats {
  const dueCount = progress.filter(
    (p) => DUE_STATES.has(p.state as CardState) && p.dueAt <= now
  ).length;
  const learnedCount = progress.filter((p) =>
    TRACKED_STATES.has(p.state as CardState)
  ).length;
  const strongCount = progress.filter(
    (p) => p.state === "REVIEW" || p.state === "MASTERED"
  ).length;
  const strongPct = wordCount > 0 ? Math.round((strongCount / wordCount) * 100) : 0;

  return { dueCount, learnedCount, strongPct };
}
