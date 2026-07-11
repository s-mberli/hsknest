import { describe, expect, it } from "vitest";

import { targetLangFilter } from "@/lib/langScope";

describe("targetLangFilter", () => {
  it("narrows UserProgress to the target language's lists", () => {
    expect(targetLangFilter("lang-123")).toEqual({
      word: { wordList: { languageId: "lang-123" } },
    });
  });

  it("returns an empty filter when no target language is set", () => {
    expect(targetLangFilter(null)).toEqual({});
    expect(targetLangFilter(undefined)).toEqual({});
  });

  // Regression guard: the dashboard ring (getDashboardStats) and the study
  // queue's daily-cap counts must scope words identically, or the ring can
  // promise a card the session then refuses. Both import this single helper, so
  // the filter shape is shared by construction — this locks that shape.
  it("produces one canonical shape both call sites depend on", () => {
    const a = targetLangFilter("x");
    const b = targetLangFilter("x");
    expect(a).toEqual(b);
    expect(Object.keys(a)).toEqual(["word"]);
  });
});
