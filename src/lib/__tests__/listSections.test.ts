import { describe, expect, it } from "vitest";

import { buildListSections } from "@/lib/listSections";

const NOW = new Date("2026-07-19T12:00:00Z");
const PAST = new Date("2026-07-18T12:00:00Z");
const FUTURE = new Date("2026-07-20T12:00:00Z");

const USER = "user-1";

function list(id: string, name: string, createdById: string | null = null) {
  return { id, name, createdById };
}

function prog(wordListId: string, state: string, dueAt: Date) {
  return { state, dueAt, word: { wordListId } };
}

function run(input: {
  lists: ReturnType<typeof list>[];
  progress?: ReturnType<typeof prog>[];
  hiddenListIds?: string[];
  priorityListIds?: string[];
}) {
  return buildListSections({
    lists: input.lists,
    progress: input.progress ?? [],
    hiddenListIds: input.hiddenListIds ?? [],
    priorityListIds: input.priorityListIds ?? [],
    userId: USER,
    now: NOW,
  });
}

describe("buildListSections — rollup", () => {
  it("counts enrolled and due; NEW/ASSUMED and future dueAt are never due", () => {
    const { byList } = run({
      lists: [list("l1", "HSK 1")],
      progress: [
        prog("l1", "REVIEW", PAST), // due
        prog("l1", "LEARNING", PAST), // due
        prog("l1", "REVIEW", FUTURE), // not yet due
        prog("l1", "NEW", PAST), // never due
        prog("l1", "ASSUMED", PAST), // never due
      ],
    });
    expect(byList.get("l1")).toEqual({ enrolled: 5, due: 2 });
  });
});

describe("buildListSections — studying", () => {
  it("excludes hidden lists even when enrolled", () => {
    const { studying } = run({
      lists: [list("l1", "HSK 1"), list("l2", "HSK 2")],
      progress: [prog("l1", "REVIEW", PAST), prog("l2", "REVIEW", PAST)],
      hiddenListIds: ["l1"],
    });
    expect(studying.map((l) => l.id)).toEqual(["l2"]);
  });

  it("sorts by due desc, then enrolled desc, then name", () => {
    const { studying } = run({
      lists: [
        list("a", "Alpha"),
        list("b", "Bravo"),
        list("c", "Charlie"),
      ],
      progress: [
        // a: 1 enrolled, 0 due
        prog("a", "NEW", PAST),
        // b: 2 enrolled, 1 due
        prog("b", "REVIEW", PAST),
        prog("b", "NEW", PAST),
        // c: 2 enrolled, 1 due  (ties b on due; b>c would tie enrolled too → name)
        prog("c", "REVIEW", PAST),
        prog("c", "NEW", PAST),
      ],
    });
    // b and c both have due=1, enrolled=2 → name tiebreak (Bravo < Charlie);
    // a has due=0 → last.
    expect(studying.map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("puts ranked lists first (rank order), unranked keep default sort", () => {
    const { studying, studyingOrder } = run({
      lists: [list("a", "Alpha"), list("b", "Bravo"), list("c", "Charlie")],
      progress: [
        prog("a", "REVIEW", PAST),
        prog("b", "REVIEW", PAST),
        prog("c", "REVIEW", PAST),
      ],
      priorityListIds: ["c", "a"],
    });
    expect(studyingOrder).toEqual(["c", "a", "b"]);
    expect(studying.map((l) => l.id)).toEqual(["c", "a", "b"]);
  });
});

describe("buildListSections — explore grouping & ownership", () => {
  it("groups HSK→level, Top N→frequency, rest→topic (alpha)", () => {
    const { exploreGroups } = run({
      lists: [
        list("t", "Food & Drink"),
        list("h1", "HSK 1 — Foundation"),
        list("f", "Top 100 Most Common"),
        list("a", "Animals"),
      ],
    });
    const byTitle = Object.fromEntries(
      exploreGroups.map((g) => [g.title, g.lists.map((l) => l.id)])
    );
    expect(byTitle["By level"]).toEqual(["h1"]);
    expect(byTitle["By frequency"]).toEqual(["f"]);
    expect(byTitle["By topic"]).toEqual(["a", "t"]); // alpha: Animals < Food
  });

  it("owned lists land in Your lists, not Explore", () => {
    const { ownLists, exploreGroups } = run({
      lists: [list("mine", "My Deck", USER), list("pub", "HSK 1")],
    });
    expect(ownLists.map((l) => l.id)).toEqual(["mine"]);
    const exploreIds = exploreGroups.flatMap((g) => g.lists.map((l) => l.id));
    expect(exploreIds).not.toContain("mine");
    expect(exploreIds).toContain("pub");
  });

  it("hidden non-owned lists land in Hidden", () => {
    const { hiddenLists, exploreGroups } = run({
      lists: [list("pub", "HSK 1")],
      hiddenListIds: ["pub"],
    });
    expect(hiddenLists.map((l) => l.id)).toEqual(["pub"]);
    const exploreIds = exploreGroups.flatMap((g) => g.lists.map((l) => l.id));
    expect(exploreIds).not.toContain("pub");
  });
});
