/**
 * Pure ordering helpers for the "Studying" list priority queue. Kept free of
 * Prisma so they're trivially unit-testable (see __tests__/listPriority.test.ts).
 *
 * Rationale for the "over-fetch + JS sort" approach: Prisma can't `orderBy` a
 * per-user rank stored in a separate table (ListPriority), so the queue route
 * queries a wider window of candidates (already ordered by word.position asc)
 * and re-sorts in JS by (rank of the word's list ?? Infinity, word.position).
 * Array.prototype.sort is stable in Node, so ties keep their DB order.
 *
 * `prioritize` drains list 1 fully before list 2; `weightedInterleave` mixes
 * several studying lists by a linear ratio (N lists → N:(N-1):…:1) instead.
 * The queue route uses `weightedInterleave` for fresh/assumed-check picks so
 * a low-priority list still gets some airtime; `prioritize` is retained for
 * tests and as the documented single-list ordering primitive.
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

/**
 * Mix candidate rows from several studying lists by a weighted ratio instead
 * of draining list 1 first. Lists are ordered like `prioritize` (ranked by
 * `rank` asc, then unranked in first-seen order) and assigned linear weights
 * N:(N-1):…:1 (2 lists → 2:1, 3 → 3:2:1). `take` is allocated across lists
 * by largest-remainder so the per-list picks sum to exactly `take`, then the
 * picks are interleaved round-robin (L1,L2,L3,L1,L2,…) so appearance is
 * spread, not front-loaded. A list that runs dry has its shortfall
 * redistributed to the remaining lists in weight order. Rows within each
 * list are taken position-asc. Pure — never mutates `rows`.
 */
export function weightedInterleave<T extends PrioritizableRow>(
  rows: T[],
  rankByListId: Map<string, number>,
  take: number
): T[] {
  if (take <= 0 || rows.length === 0) return [];

  // Distinct lists, ranked (rank asc) then unranked in first-seen order.
  const listOrder: string[] = [];
  for (const r of rows) {
    if (!listOrder.includes(r.word.wordListId)) {
      listOrder.push(r.word.wordListId);
    }
  }
  const stableRanked = listOrder
    .map((id, i) => ({ id, rank: rankByListId.get(id) ?? Infinity, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.id);

  // Weights N, N-1, …, 1.
  const n = stableRanked.length;
  const weights = new Map(stableRanked.map((id, i) => [id, n - i]));
  const totalWeight = (n * (n + 1)) / 2;

  // Candidates per list, position-asc.
  const byList = new Map<string, T[]>();
  for (const r of rows) {
    const arr = byList.get(r.word.wordListId) ?? [];
    arr.push(r);
    byList.set(r.word.wordListId, arr);
  }
  for (const arr of byList.values()) {
    arr.sort((a, b) => a.word.position - b.word.position);
  }

  // Largest-remainder allocation of `take` by weight.
  const alloc = new Map<string, number>();
  let floorSum = 0;
  const remainders: { id: string; rem: number }[] = [];
  for (const id of stableRanked) {
    const exact = (take * (weights.get(id) ?? 0)) / totalWeight;
    const floor = Math.floor(exact);
    alloc.set(id, floor);
    floorSum += floor;
    remainders.push({ id, rem: exact - floor });
  }
  // Leftover slots go to the largest remainders (ties keep weight order).
  remainders.sort((a, b) => b.rem - a.rem);
  let leftover = take - floorSum;
  for (const { id } of remainders) {
    if (leftover <= 0) break;
    alloc.set(id, (alloc.get(id) ?? 0) + 1);
    leftover -= 1;
  }

  // Cap each list's allocation by what it actually has.
  const picks = new Map<string, T[]>();
  for (const id of stableRanked) {
    picks.set(id, (byList.get(id) ?? []).slice(0, alloc.get(id) ?? 0));
  }

  // Redistribute any shortfall from dry lists to later lists with spare rows.
  let deficit = take;
  for (const id of stableRanked) deficit -= (picks.get(id) ?? []).length;
  if (deficit > 0) {
    for (const id of stableRanked) {
      if (deficit <= 0) break;
      const have = byList.get(id) ?? [];
      const cur = picks.get(id) ?? [];
      const give = Math.min(have.length - cur.length, deficit);
      if (give > 0) {
        picks.set(id, have.slice(0, cur.length + give));
        deficit -= give;
      }
    }
  }

  // Round-robin interleave in weight order.
  const result: T[] = [];
  let round = 0;
  let progressed = true;
  while (progressed && result.length < take) {
    progressed = false;
    for (const id of stableRanked) {
      if (result.length >= take) break;
      const arr = picks.get(id) ?? [];
      if (round < arr.length) {
        result.push(arr[round]);
        progressed = true;
      }
    }
    round += 1;
  }
  return result;
}
