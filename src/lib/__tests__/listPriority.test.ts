import { describe, expect, it } from "vitest";

import { prioritize, rankListIds, weightedInterleave } from "@/lib/listPriority";

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

describe("weightedInterleave", () => {
  it("returns [] for take 0 or empty rows", () => {
    expect(weightedInterleave([], new Map(), 5)).toEqual([]);
    expect(weightedInterleave([row("l1", 0)], new Map(), 0)).toEqual([]);
  });

  it("is a no-op for a single list (returns first take rows, position asc)", () => {
    const rows = [row("l1", 3), row("l1", 1), row("l1", 2)];
    const result = weightedInterleave(rows, new Map([["l1", 0]]), 2);
    expect(result.map((r) => r.word.position)).toEqual([1, 2]);
  });

  it("mixes 2 lists at 2:1 with round-robin spread (L1,L2,L1)", () => {
    const l1 = [0, 1, 2, 3, 4].map((p) => row("l1", p));
    const l2 = [0, 1].map((p) => row("l2", p));
    const rows = [...l1, ...l2];
    const result = weightedInterleave(
      rows,
      new Map([
        ["l1", 0],
        ["l2", 1],
      ]),
      3
    );
    expect(result.map((r) => r.word.wordListId)).toEqual(["l1", "l2", "l1"]);
    // Position order preserved within each list.
    const l1Picks = result.filter((r) => r.word.wordListId === "l1");
    const l2Picks = result.filter((r) => r.word.wordListId === "l2");
    expect(l1Picks.map((r) => r.word.position)).toEqual([0, 1]);
    expect(l2Picks.map((r) => r.word.position)).toEqual([0]);
  });

  it("mixes 3 lists at 3:2:1 (take 6 → L1,L2,L3,L1,L2,L1)", () => {
    const rows = [
      ...[0, 1, 2].map((p) => row("l1", p)),
      ...[0, 1].map((p) => row("l2", p)),
      ...[0].map((p) => row("l3", p)),
    ];
    const result = weightedInterleave(
      rows,
      new Map([
        ["l1", 0],
        ["l2", 1],
        ["l3", 2],
      ]),
      6
    );
    expect(result.map((r) => r.word.wordListId)).toEqual([
      "l1",
      "l2",
      "l3",
      "l1",
      "l2",
      "l1",
    ]);
  });

  it("redistributes a dry list's shortfall to the remaining lists in order", () => {
    // l1 (weight 2) has only 1 row; l2 (weight 1) has 4. take 3 → l1:1, l2:2.
    const rows = [row("l1", 0), ...[0, 1, 2, 3].map((p) => row("l2", p))];
    const result = weightedInterleave(
      rows,
      new Map([
        ["l1", 0],
        ["l2", 1],
      ]),
      3
    );
    expect(result.map((r) => r.word.wordListId)).toEqual(["l1", "l2", "l2"]);
    expect(result).toHaveLength(3);
  });

  it("keeps stable order when no lists are ranked (weights equal → 1:1:1)", () => {
    const rows = [
      row("a", 0),
      row("a", 1),
      row("b", 0),
      row("b", 1),
      row("c", 0),
    ];
    const result = weightedInterleave(rows, new Map(), 5);
    // Equal weights: 5 rows, take 5 → everything, round-robin in first-seen order.
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.word.wordListId)).toEqual([
      "a",
      "b",
      "c",
      "a",
      "b",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [row("l1", 0), row("l2", 0)];
    const original = [...rows];
    weightedInterleave(rows, new Map([["l1", 0]]), 2);
    expect(rows).toEqual(original);
  });

  it("respects a rank order that differs from first-seen order", () => {
    const rows = [
      ...[0, 1].map((p) => row("l2", p)),
      ...[0, 1, 2, 3].map((p) => row("l1", p)),
    ];
    const result = weightedInterleave(
      rows,
      new Map([
        ["l1", 0],
        ["l2", 1],
      ]),
      3
    );
    // l1 ranked first → weight 2, l2 weight 1 → l1,l2,l1 despite l2 first in rows.
    expect(result.map((r) => r.word.wordListId)).toEqual(["l1", "l2", "l1"]);
  });
});
