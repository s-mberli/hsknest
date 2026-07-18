import { describe, expect, it } from "vitest";

import { prioritize, rankListIds } from "@/lib/listPriority";

function row(wordListId: string, position: number) {
  return { word: { wordListId, position } };
}

describe("rankListIds", () => {
  it("preserves order when the rank map is empty", () => {
    expect(rankListIds([], ["b", "a", "c"])).toEqual(["b", "a", "c"]);
  });

  it("puts ranked lists first, in rank order", () => {
    expect(rankListIds(["c", "a"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("keeps unranked lists in their original relative order", () => {
    expect(rankListIds(["z"], ["a", "b", "z", "c"])).toEqual([
      "z",
      "a",
      "b",
      "c",
    ]);
  });
});

describe("prioritize", () => {
  it("preserves order when the rank map is empty", () => {
    const rows = [row("l2", 0), row("l1", 1), row("l2", 2)];
    expect(prioritize(rows, new Map())).toEqual(rows);
  });

  it("puts ranked lists first, in rank order", () => {
    const rows = [row("l1", 0), row("l2", 0), row("l3", 0)];
    const rank = new Map([
      ["l3", 0],
      ["l1", 1],
    ]);
    const result = prioritize(rows, rank);
    expect(result.map((r) => r.word.wordListId)).toEqual(["l3", "l1", "l2"]);
  });

  it("is stable within a list, ordering by word position", () => {
    const rows = [row("l1", 5), row("l1", 1), row("l1", 3)];
    const rank = new Map([["l1", 0]]);
    const result = prioritize(rows, rank);
    expect(result.map((r) => r.word.position)).toEqual([1, 3, 5]);
  });

  it("keeps unranked lists in their original relative order after ranked ones", () => {
    const rows = [
      row("unranked-a", 0),
      row("ranked", 0),
      row("unranked-b", 0),
    ];
    const rank = new Map([["ranked", 0]]);
    const result = prioritize(rows, rank);
    expect(result.map((r) => r.word.wordListId)).toEqual([
      "ranked",
      "unranked-a",
      "unranked-b",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [row("l1", 0), row("l2", 0)];
    const original = [...rows];
    prioritize(rows, new Map([["l2", 0]]));
    expect(rows).toEqual(original);
  });
});
