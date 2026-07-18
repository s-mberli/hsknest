/**
 * Pure ordering helpers for the "Studying" list priority queue. Kept free of
 * Prisma so they're trivially unit-testable (see __tests__/listPriority.test.ts).
 *
 * Rationale for the "over-fetch + JS sort" approach: Prisma can't `orderBy` a
 * per-user rank stored in a separate table (ListPriority), so the queue route
 * queries a wider window of candidates (already ordered by word.position asc)
 * and re-sorts in JS by (rank of the word's list ?? Infinity, word.position).
 * Array.prototype.sort is stable in Node, so ties keep their DB order.
 */

/**
 * Reorder `candidateListIds` so ranked ids come first (in rank order), then
 * the rest in their original relative order. Exposed mainly for tests /
 * documentation of the ordering rule; `prioritize` below is what the queue
 * route actually uses on row data.
 */
export function rankListIds(
  rankedIds: string[],
  candidateListIds: string[]
): string[] {
  const rankIndex = new Map(rankedIds.map((id, i) => [id, i]));
  const ranked = candidateListIds
    .filter((id) => rankIndex.has(id))
    .sort((a, b) => rankIndex.get(a)! - rankIndex.get(b)!);
  const rankedSet = new Set(ranked);
  const unranked = candidateListIds.filter((id) => !rankedSet.has(id));
  // De-dupe ranked (a list id may repeat in candidateListIds).
  const seen = new Set<string>();
  const dedupedRanked = ranked.filter((id) =>
    seen.has(id) ? false : (seen.add(id), true)
  );
  return [...dedupedRanked, ...unranked];
}

interface PrioritizableRow {
  word: { wordListId: string; position: number };
}

/**
 * Stable-sort candidate UserProgress rows by (list rank ?? Infinity, word
 * position). Rows whose list has no entry in `rankByListId` keep their
 * relative order among themselves (stable sort + Infinity rank). Does not
 * mutate `rows`.
 */
export function prioritize<T extends PrioritizableRow>(
  rows: T[],
  rankByListId: Map<string, number>
): T[] {
  if (rankByListId.size === 0) return rows.slice();
  return rows
    .slice()
    .sort((a, b) => {
      const rankA = rankByListId.get(a.word.wordListId) ?? Infinity;
      const rankB = rankByListId.get(b.word.wordListId) ?? Infinity;
      if (rankA !== rankB) return rankA - rankB;
      return a.word.position - b.word.position;
    });
}
