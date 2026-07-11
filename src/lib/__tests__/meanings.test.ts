import { describe, expect, it } from "vitest";

import { gameGloss, parseMeanings, primaryGloss } from "../meanings";

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

describe("gameGloss", () => {
  it("strips a trailing parenthetical", () => {
    expect(
      gameGloss({ translation: "you (informal, as opposed to courteous 您)" })
    ).toBe("you");
  });

  it("unwraps a fully parenthetical gloss instead of deleting it", () => {
    expect(gameGloss({ translation: "(completed action marker)" })).toBe(
      "completed action marker"
    );
  });

  it("leaves short plain glosses untouched", () => {
    expect(gameGloss({ translation: "hello" })).toBe("hello");
  });

  it("truncates long glosses at a word boundary with an ellipsis", () => {
    const out = gameGloss({
      translation: "a very long explanation that keeps going and going forever",
    });
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toBe("a very long explanation that keeps…");
  });

  it("uses only the primary sense", () => {
    expect(gameGloss({ translation: "of; ~'s (possessive particle); target" })).toBe(
      "of"
    );
  });
});
