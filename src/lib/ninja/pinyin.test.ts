import { describe, it, expect } from "vitest";
import { syllables, toneOf, stripTone, toneMark, tonelessPhonetic } from "./pinyin";

describe("pinyin utilities", () => {
  describe("syllables()", () => {
    it("splits on spaces", () => {
      expect(syllables("wǒ men")).toEqual(["wǒ", "men"]);
    });

    it("handles single syllable", () => {
      expect(syllables("wǒ")).toEqual(["wǒ"]);
    });

    it("handles multi-syllable", () => {
      expect(syllables("shén me")).toEqual(["shén", "me"]);
    });

    it("filters empty strings", () => {
      expect(syllables("wǒ  men")).toEqual(["wǒ", "men"]);
    });

    it("handles empty input", () => {
      expect(syllables("")).toEqual([]);
    });
  });

  describe("toneOf()", () => {
    // Tone 1 (macron ‾)
    it("detects tone 1 (macron) on ā", () => {
      expect(toneOf("ā")).toBe(1);
    });

    it("detects tone 1 on ē", () => {
      expect(toneOf("ē")).toBe(1);
    });

    it("detects tone 1 on ī", () => {
      expect(toneOf("ī")).toBe(1);
    });

    it("detects tone 1 on ō", () => {
      expect(toneOf("ō")).toBe(1);
    });

    it("detects tone 1 on ū", () => {
      expect(toneOf("ū")).toBe(1);
    });

    it("detects tone 1 on ǖ (ü with macron)", () => {
      expect(toneOf("ǖ")).toBe(1);
    });

    // Tone 2 (acute ´)
    it("detects tone 2 (acute) on á", () => {
      expect(toneOf("á")).toBe(2);
    });

    it("detects tone 2 on é", () => {
      expect(toneOf("é")).toBe(2);
    });

    it("detects tone 2 on í", () => {
      expect(toneOf("í")).toBe(2);
    });

    it("detects tone 2 on ó", () => {
      expect(toneOf("ó")).toBe(2);
    });

    it("detects tone 2 on ú", () => {
      expect(toneOf("ú")).toBe(2);
    });

    it("detects tone 2 on ǘ (ü with acute)", () => {
      expect(toneOf("ǘ")).toBe(2);
    });

    // Tone 3 (caron ˇ)
    it("detects tone 3 (caron) on ǎ", () => {
      expect(toneOf("ǎ")).toBe(3);
    });

    it("detects tone 3 on ě", () => {
      expect(toneOf("ě")).toBe(3);
    });

    it("detects tone 3 on ǐ", () => {
      expect(toneOf("ǐ")).toBe(3);
    });

    it("detects tone 3 on ǒ", () => {
      expect(toneOf("ǒ")).toBe(3);
    });

    it("detects tone 3 on ǔ", () => {
      expect(toneOf("ǔ")).toBe(3);
    });

    it("detects tone 3 on ǚ (ü with caron)", () => {
      expect(toneOf("ǚ")).toBe(3);
    });

    // Tone 4 (grave `)
    it("detects tone 4 (grave) on à", () => {
      expect(toneOf("à")).toBe(4);
    });

    it("detects tone 4 on è", () => {
      expect(toneOf("è")).toBe(4);
    });

    it("detects tone 4 on ì", () => {
      expect(toneOf("ì")).toBe(4);
    });

    it("detects tone 4 on ò", () => {
      expect(toneOf("ò")).toBe(4);
    });

    it("detects tone 4 on ù", () => {
      expect(toneOf("ù")).toBe(4);
    });

    it("detects tone 4 on ǜ (ü with grave)", () => {
      expect(toneOf("ǜ")).toBe(4);
    });

    // Tone 5 (neutral, no mark)
    it("detects tone 5 on a (no mark)", () => {
      expect(toneOf("a")).toBe(5);
    });

    it("detects tone 5 on ma", () => {
      expect(toneOf("ma")).toBe(5);
    });

    it("detects tone 5 on de", () => {
      expect(toneOf("de")).toBe(5);
    });

    it("detects tone 5 on lü (ü no tone)", () => {
      expect(toneOf("lü")).toBe(5);
    });

    // Multi-character syllables
    it("finds tone mark in multi-char syllable (zhǔ)", () => {
      expect(toneOf("zhǔ")).toBe(3);
    });

    it("finds tone mark in multi-char syllable (lǚ with caron)", () => {
      expect(toneOf("lǚ")).toBe(3);
    });
  });

  describe("stripTone()", () => {
    it("strips tone from ā → a", () => {
      expect(stripTone("ā")).toBe("a");
    });

    it("strips tone from wǒ → wo", () => {
      expect(stripTone("wǒ")).toBe("wo");
    });

    it("strips tone from lǜ → lü (preserves diaeresis)", () => {
      expect(stripTone("lǜ")).toBe("lü");
    });

    it("strips tone from qū → qu", () => {
      expect(stripTone("qū")).toBe("qu");
    });

    it("strips tone from jiàn → jian", () => {
      expect(stripTone("jiàn")).toBe("jian");
    });

    it("handles unmarked syllables (neutral tone)", () => {
      expect(stripTone("ma")).toBe("ma");
    });

    it("handles multiple vowel syllables", () => {
      expect(stripTone("zhuāng")).toBe("zhuang");
    });

    it("preserves ü diaeresis in lǚ → lü", () => {
      expect(stripTone("lǚ")).toBe("lü");
    });

    it("handles all four tones on same vowel", () => {
      expect([stripTone("ā"), stripTone("á"), stripTone("ǎ"), stripTone("à")]).toEqual([
        "a",
        "a",
        "a",
        "a",
      ]);
    });
  });

  describe("toneMark()", () => {
    it("returns macron for tone 1", () => {
      expect(toneMark(1)).toBe("̄");
    });

    it("returns acute for tone 2", () => {
      expect(toneMark(2)).toBe("́");
    });

    it("returns caron for tone 3", () => {
      expect(toneMark(3)).toBe("̌");
    });

    it("returns grave for tone 4", () => {
      expect(toneMark(4)).toBe("̀");
    });

    it("returns empty string for tone 5", () => {
      expect(toneMark(5)).toBe("");
    });
  });

  describe("tonelessPhonetic()", () => {
    it("strips tones from multi-syllable phonetic", () => {
      expect(tonelessPhonetic("wǒ men")).toBe("wo men");
    });

    it("handles single syllable", () => {
      expect(tonelessPhonetic("wǒ")).toBe("wo");
    });

    it("preserves ü in toneless form", () => {
      expect(tonelessPhonetic("lǜ")).toBe("lü");
    });

    it("handles mixed tone and neutral", () => {
      expect(tonelessPhonetic("zhè ge")).toBe("zhe ge");
    });

    it("handles all tones in input", () => {
      expect(tonelessPhonetic("mā má mǎ mà ma")).toBe("ma ma ma ma ma");
    });
  });
});
