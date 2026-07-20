import { describe, expect, it } from "vitest";

import { toCards } from "@/lib/buildQueue";

import type { Prisma } from "@prisma/client";

function makeRow(
  wordId: string,
  state: string,
  position = 0,
  lapses = 0
) {
  return {
    wordId,
    state,
    lapses,
    word: {
      term: `term-${wordId}`,
      translation: `trans-${wordId}`,
      phonetic: null,
      metadata: null as Prisma.JsonValue,
      wordListId: "list-1",
      position,
      wordList: { language: { code: "zh" } },
    },
  };
}

describe("toCards", () => {
  it("maps a single progress row to a QueueCard with 'review' kind", () => {
    const rows = [makeRow("w1", "REVIEW")];
    const cards = toCards(rows, "review");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      wordId: "w1",
      state: "REVIEW",
      kind: "review",
      languageCode: "zh",
    });
  });

  it("maps rows with 'check' kind", () => {
    const rows = [makeRow("w2", "ASSUMED")];
    const cards = toCards(rows, "check");
    expect(cards[0].kind).toBe("check");
  });

  it("maps rows with 'new' kind", () => {
    const rows = [makeRow("w3", "NEW")];
    const cards = toCards(rows, "new");
    expect(cards[0].kind).toBe("new");
  });

  it("sets empty phonetic to null, not empty string", () => {
    const rows = [makeRow("w4", "REVIEW")];
    const cards = toCards(rows, "review");
    expect(cards[0].phonetic).toBeNull();
  });

  it("preserves term, translation, lapses", () => {
    const rows = [makeRow("w5", "LAPSED", 3, 5)];
    rows[0].lapses = 5;
    const cards = toCards(rows, "review");
    expect(cards[0].term).toBe("term-w5");
    expect(cards[0].translation).toBe("trans-w5");
    expect(cards[0].lapses).toBe(5);
  });

  it("handles empty input", () => {
    expect(toCards([], "review")).toEqual([]);
  });

  it("maps multiple rows", () => {
    const rows = [makeRow("w1", "REVIEW"), makeRow("w2", "REVIEW"), makeRow("w3", "REVIEW")];
    const cards = toCards(rows, "review");
    expect(cards).toHaveLength(3);
  });
});
