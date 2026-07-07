import { describe, expect, it } from "vitest";

import { lookupChinese, toneMarks } from "@/lib/dictionary";

describe("toneMarks", () => {
  it("places marks on a/e first", () => {
    expect(toneMarks("ni3 hao3")).toBe("nǐ hǎo");
    expect(toneMarks("xie4 xie5")).toBe("xiè xie");
  });

  it("handles ou and trailing vowels", () => {
    expect(toneMarks("gou3")).toBe("gǒu");
    expect(toneMarks("shui3")).toBe("shuǐ");
  });

  it("converts u: and v to ü", () => {
    expect(toneMarks("nu:3")).toBe("nǚ");
    expect(toneMarks("lv4")).toBe("lǜ");
  });

  it("leaves non-pinyin tokens untouched", () => {
    expect(toneMarks("abc")).toBe("abc");
  });
});

describe("lookupChinese", () => {
  it("finds a common word with pinyin and meaning", () => {
    const result = lookupChinese("你好");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].phonetic).toBe("nǐ hǎo");
    expect(result[0].translation.toLowerCase()).toContain("hello");
  });

  it("returns [] for unknown terms", () => {
    expect(lookupChinese("qqqqzzzz")).toEqual([]);
  });
});
