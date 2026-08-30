import { describe, expect, it } from "vitest";

import {
  PRACTICE_MODE_LABELS,
  getPracticeAvailability,
} from "@/lib/practiceModes";

describe("getPracticeAvailability", () => {
  it("offers every mode for a romanised-reading language with sentences", () => {
    expect(
      getPracticeAvailability({ languageCode: "zh", hasSentences: true })
    ).toEqual({
      rotatable: ["quiz", "match", "pronounce", "sentences"],
      ninja: true,
    });
  });

  it("hides Reading Quiz for a language without a romanised reading", () => {
    const { rotatable } = getPracticeAvailability({
      languageCode: "de",
      hasSentences: true,
    });
    expect(rotatable).toEqual(["quiz", "match", "sentences"]);
  });

  it("hides Sentences when the language has no sentence data", () => {
    const { rotatable } = getPracticeAvailability({
      languageCode: "zh",
      hasSentences: false,
    });
    expect(rotatable).toEqual(["quiz", "match", "pronounce"]);
  });

  it("falls back to the language-agnostic modes when neither applies", () => {
    const { rotatable } = getPracticeAvailability({
      languageCode: "de",
      hasSentences: false,
    });
    expect(rotatable).toEqual(["quiz", "match"]);
  });

  it("treats a missing language code as having no romanised reading", () => {
    for (const languageCode of [undefined, null]) {
      const { rotatable } = getPracticeAvailability({ languageCode });
      expect(rotatable).toEqual(["quiz", "match"]);
    }
  });

  it("never returns Word Ninja as a rotation candidate", () => {
    for (const hasSentences of [true, false]) {
      for (const languageCode of ["zh", "de"]) {
        const { rotatable, ninja } = getPracticeAvailability({
          languageCode,
          hasSentences,
        });
        expect(rotatable).not.toContain("ninja");
        expect(ninja).toBe(true);
      }
    }
  });

  it("labels every rotatable mode it can return", () => {
    const { rotatable } = getPracticeAvailability({
      languageCode: "zh",
      hasSentences: true,
    });
    for (const key of rotatable) {
      expect(PRACTICE_MODE_LABELS[key]).toBeTruthy();
    }
  });
});
