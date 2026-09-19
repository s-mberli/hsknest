import { describe, expect, it } from "vitest";

import { languageAfterSuccessfulLoad } from "../../components/words/WordBrowser";

describe("languageAfterSuccessfulLoad", () => {
  it("uses the target language only for the first successful load", () => {
    expect(languageAfterSuccessfulLoad("all", "zh", false)).toBe("zh");
    expect(languageAfterSuccessfulLoad("es", "zh", true)).toBe("es");
  });

  it("keeps the current selection when no target language is available", () => {
    expect(languageAfterSuccessfulLoad("all", null, false)).toBe("all");
  });
});
