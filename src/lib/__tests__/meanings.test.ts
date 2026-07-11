import { describe, expect, it } from "vitest";

import { parseMeanings, primaryGloss } from "../meanings";

describe("parseMeanings", () => {
  it("prefers structured metadata.meanings", () => {
    const word = {
      translation: "(completed action marker); to finish",
      metadata: {
        meanings: [
          { gloss: "(completed action marker)" },
          { gloss: "to finish", reading: "liǎo" },
        ],
      },
    };
    expect(parseMeanings(word)).toEqual([
      { gloss: "(completed action marker)" },
      { gloss: "to finish", reading: "liǎo" },
    ]);
  });

  it("falls back to splitting the translation on semicolons", () => {
    expect(parseMeanings({ translation: "to yield; to permit; to let sb do sth" })).toEqual([
      { gloss: "to yield" },
      { gloss: "to permit" },
      { gloss: "to let sb do sth" },
    ]);
  });

  it("returns the whole translation when there is nothing to split", () => {
    expect(parseMeanings({ translation: "hello" })).toEqual([{ gloss: "hello" }]);
  });

  it("ignores malformed metadata", () => {
    expect(parseMeanings({ translation: "a; b", metadata: { meanings: "junk" } })).toEqual([
      { gloss: "a" },
      { gloss: "b" },
    ]);
    expect(parseMeanings({ translation: "a", metadata: { meanings: [{ nope: 1 }] } })).toEqual([
      { gloss: "a" },
    ]);
  });
});

describe("primaryGloss", () => {
  it("returns the first sense", () => {
    expect(primaryGloss({ translation: "to yield; to permit" })).toBe("to yield");
  });
});
