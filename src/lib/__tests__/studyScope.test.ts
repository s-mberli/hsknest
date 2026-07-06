import { describe, expect, it } from "vitest";

import { parseQueueQuery, scopeToWordWhere } from "@/lib/studyScope";

function params(init: Record<string, string>): URLSearchParams {
  return new URLSearchParams(init);
}

describe("parseQueueQuery — limit resolution", () => {
  it("defaults to 20 with no params", () => {
    expect(parseQueueQuery(params({})).limit).toBe(20);
  });

  it("uses limit when provided", () => {
    expect(parseQueueQuery(params({ limit: "10" })).limit).toBe(10);
  });

  it("minutes wins over limit and converts ×5", () => {
    expect(parseQueueQuery(params({ minutes: "5", limit: "10" })).limit).toBe(
      25
    );
  });

  it("caps at 500", () => {
    expect(parseQueueQuery(params({ limit: "9999" })).limit).toBe(500);
    expect(parseQueueQuery(params({ minutes: "1000" })).limit).toBe(500);
  });

  it("ignores garbage and negatives, falling back to default", () => {
    expect(parseQueueQuery(params({ limit: "abc" })).limit).toBe(20);
    expect(parseQueueQuery(params({ limit: "-5" })).limit).toBe(20);
    expect(parseQueueQuery(params({ minutes: "0" })).limit).toBe(20);
  });
});

describe("parseQueueQuery — scope parsing", () => {
  it("returns empty scope with no params", () => {
    expect(parseQueueQuery(params({})).scope).toEqual({});
  });

  it("parses languageId", () => {
    expect(parseQueueQuery(params({ languageId: "lang1" })).scope).toEqual({
      languageId: "lang1",
    });
  });

  it("parses comma-separated listIds", () => {
    expect(parseQueueQuery(params({ listIds: "a,b,c" })).scope).toEqual({
      listIds: ["a", "b", "c"],
    });
  });

  it("trims whitespace in listIds", () => {
    expect(parseQueueQuery(params({ listIds: " a , b " })).scope).toEqual({
      listIds: ["a", "b"],
    });
  });

  it("drops empty segments in listIds", () => {
    expect(parseQueueQuery(params({ listIds: "a,,b," })).scope).toEqual({
      listIds: ["a", "b"],
    });
  });

  it("dedupes listIds", () => {
    expect(parseQueueQuery(params({ listIds: "a,b,a" })).scope).toEqual({
      listIds: ["a", "b"],
    });
  });

  it("treats an all-empty listIds string as absent", () => {
    expect(parseQueueQuery(params({ listIds: ",, ," })).scope).toEqual({});
  });

  it("combines languageId and listIds", () => {
    expect(
      parseQueueQuery(params({ languageId: "zh", listIds: "a,b" })).scope
    ).toEqual({ languageId: "zh", listIds: ["a", "b"] });
  });
});

describe("scopeToWordWhere", () => {
  it("returns {} for an empty scope", () => {
    expect(scopeToWordWhere({})).toEqual({});
  });

  it("filters by languageId only", () => {
    expect(scopeToWordWhere({ languageId: "zh" })).toEqual({
      word: { wordList: { languageId: "zh" } },
    });
  });

  it("filters by listIds only", () => {
    expect(scopeToWordWhere({ listIds: ["a", "b"] })).toEqual({
      word: { wordList: { id: { in: ["a", "b"] } } },
    });
  });

  it("combines languageId and listIds", () => {
    expect(
      scopeToWordWhere({ languageId: "zh", listIds: ["a", "b"] })
    ).toEqual({
      word: { wordList: { id: { in: ["a", "b"] }, languageId: "zh" } },
    });
  });

  it("ignores an empty listIds array", () => {
    expect(scopeToWordWhere({ listIds: [] })).toEqual({});
  });
});
