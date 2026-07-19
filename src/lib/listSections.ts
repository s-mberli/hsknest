import { rankListIds } from "@/lib/listPriority";

/**
 * Pure data-shaping for the Lists page: turns the user's visible lists +
 * progress into the four rendered sections. Kept free of Prisma/React so it's
 * unit-testable (see __tests__/listSections.test.ts) and `now` is injected
 * rather than read from the clock.
 */

export interface ListRollup {
  enrolled: number;
  due: number;
}

export interface ListSections<L> {
  /** Enrolled, not hidden — ranked lists first, then default sort. */
  studying: L[];
  studyingOrder: string[];
  /** Owned lists not already in Studying. */
  ownLists: L[];
  /** Non-owned, non-hidden lists grouped as a curriculum. */
  exploreGroups: { title: string; lists: L[] }[];
  /** Non-owned lists the user has hidden. */
  hiddenLists: L[];
  byList: Map<string, ListRollup>;
  hiddenIds: Set<string>;
  studyingIds: Set<string>;
}

interface ProgressRow {
  state: string;
  dueAt: Date;
  word: { wordListId: string };
}

type BaseList = { id: string; name: string; createdById: string | null };

export function buildListSections<L extends BaseList>(input: {
  lists: L[];
  progress: ProgressRow[];
  hiddenListIds: string[];
  /** Already rank-ordered (rank asc). */
  priorityListIds: string[];
  userId: string;
  now: Date;
}): ListSections<L> {
  const { lists, progress, hiddenListIds, priorityListIds, userId, now } = input;

  // Per-list rollup: how many of its words are in the queue, how many due.
  const byList = new Map<string, ListRollup>();
  for (const p of progress) {
    const key = p.word.wordListId;
    const entry = byList.get(key) ?? { enrolled: 0, due: 0 };
    entry.enrolled += 1;
    if (p.state !== "NEW" && p.state !== "ASSUMED" && p.dueAt <= now) {
      entry.due += 1;
    }
    byList.set(key, entry);
  }

  const hiddenIds = new Set(hiddenListIds);

  // Sections, in reading order: what you study, what you made, what you could
  // add, what you tucked away. Hidden wins over studying (so hiding stops study).
  const defaultSortedStudying = lists
    .filter((l) => (byList.get(l.id)?.enrolled ?? 0) > 0 && !hiddenIds.has(l.id))
    .sort((a, b) => {
      const sa = byList.get(a.id) ?? { enrolled: 0, due: 0 };
      const sb = byList.get(b.id) ?? { enrolled: 0, due: 0 };
      return sb.due - sa.due || sb.enrolled - sa.enrolled || a.name.localeCompare(b.name);
    });

  // Ranked lists first (in rank order), unranked after (keeping their default
  // sort). Delegates to the same ordering rule the study queue uses, so the
  // two never drift.
  const orderedIds = rankListIds(
    priorityListIds,
    defaultSortedStudying.map((l) => l.id)
  );
  const byId = new Map(defaultSortedStudying.map((l) => [l.id, l]));
  const studying = orderedIds.map((id) => byId.get(id)!);
  const studyingOrder = studying.map((l) => l.id);
  const studyingIds = new Set(studyingOrder);

  const ownLists = lists
    .filter((l) => l.createdById === userId && !studyingIds.has(l.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const exploreLists = lists.filter(
    (l) =>
      l.createdById !== userId &&
      !studyingIds.has(l.id) &&
      !hiddenIds.has(l.id)
  );

  // Explore reads as a curriculum: graded exam levels first, then frequency
  // lists, then topic sets — instead of one undifferentiated grid.
  const exploreGroups = [
    { title: "By level", lists: exploreLists.filter((l) => /^HSK\b/i.test(l.name)) },
    { title: "By frequency", lists: exploreLists.filter((l) => /\bTop \d+/i.test(l.name)) },
  ];
  const grouped = new Set(exploreGroups.flatMap((g) => g.lists.map((l) => l.id)));
  exploreGroups.push({
    title: "By topic",
    lists: exploreLists
      .filter((l) => !grouped.has(l.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });

  const hiddenLists = lists.filter(
    (l) => l.createdById !== userId && hiddenIds.has(l.id)
  );

  return {
    studying,
    studyingOrder,
    ownLists,
    exploreGroups,
    hiddenLists,
    byList,
    hiddenIds,
    studyingIds,
  };
}
