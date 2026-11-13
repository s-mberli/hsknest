/**
 * Starter ordering for the first new words of the seeded HSK 1 list.
 *
 * `Word.position` in "HSK 1 — Foundation" is frequency order, so a beginner's
 * first new cards would be grammar particles (的, 了, …) while 谢谢, 再见 and
 * 你好 sit at positions 129, 228 and 294. The queue therefore introduces a small
 * fixed starter set first. This is a queue-time ordering only:
 *
 * - stored positions are untouched, so Words/Lists browse order is unchanged;
 * - it only reorders rows the caller passes in, which the queue restricts to
 *   state NEW — words already introduced are never touched or re-queued;
 * - review scheduling (`src/lib/srs/`) is not involved.
 *
 * Kept free of Prisma so it is unit-testable (see __tests__/starterOrder.test.ts).
 */

/** Seeded list name — stable seed content, see ZH_LISTS in prisma/seed.ts. */
export const HSK1_STARTER_LIST_NAME = "HSK 1 — Foundation";

/** Introduced in this order, ahead of the list's frequency order. */
export const HSK1_STARTER_TERMS: readonly string[] = [
  "你好",
  "谢谢",
  "再见",
  "我",
  "你",
  "是",
  "好",
  "不",
  "他",
  "这",
];

const STARTER_INDEX = new Map(HSK1_STARTER_TERMS.map((term, i) => [term, i]));

/**
 * Prisma `word` filter selecting the starter words of the seeded HSK 1 list.
 * `createdById: null` keeps a learner's own list with the same name out.
 */
export const starterWordWhere = {
  term: { in: [...HSK1_STARTER_TERMS] },
  wordList: { name: HSK1_STARTER_LIST_NAME, createdById: null },
};

interface StarterOrderableRow {
  wordId: string;
  word: {
    term: string;
    position: number;
    wordList: { name: string; createdById: string | null };
  };
}

function starterIndex(row: StarterOrderableRow): number | undefined {
  const { name, createdById } = row.word.wordList;
  if (name !== HSK1_STARTER_LIST_NAME || createdById !== null) return undefined;
  return STARTER_INDEX.get(row.word.term);
}

/**
 * Merge the position-ordered candidate window with the learner's remaining
 * starter rows (which may lie beyond the window) and give starter rows an
 * effective position ahead of every stored one, in starter order. The result
 * feeds `weightedInterleave`, which orders each list by `word.position`.
 *
 * Returned starter rows are copies; inputs are never mutated and the
 * effective position is never persisted.
 */
export function withStarterOrder<T extends StarterOrderableRow>(
  windowRows: T[],
  starterRows: T[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const row of [...windowRows, ...starterRows]) {
    if (seen.has(row.wordId)) continue;
    seen.add(row.wordId);
    const index = starterIndex(row);
    merged.push(
      index === undefined
        ? row
        : {
            ...row,
            word: {
              ...row.word,
              position: index - HSK1_STARTER_TERMS.length,
            },
          }
    );
  }
  return merged;
}
