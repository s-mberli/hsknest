import { describe, it, expect } from "vitest";
import { pickDistractors, type NinjaWord } from "@/lib/ninja/distractors";

describe("ninjaDistractors", () => {
  const mockWords: NinjaWord[] = [
    { wordId: "吃", term: "吃", translation: "eat", pos: ["verb", "transitive"] },
    { wordId: "喝", term: "喝", translation: "drink", pos: ["verb", "transitive"] },
    { wordId: "睡", term: "睡", translation: "sleep", pos: ["verb"] },
    { wordId: "走", term: "走", translation: "walk", pos: ["verb", "intransitive"] },
    { wordId: "学生", term: "学生", translation: "student", pos: ["noun"] },
    { wordId: "老师", term: "老师", translation: "teacher", pos: ["noun"] },
    { wordId: "中国", term: "中国", translation: "China", pos: ["proper noun"] },
    { wordId: "美国", term: "美国", translation: "USA", pos: ["proper noun"] },
  ];

  describe("pickDistractors", () => {
    it("returns the requested count of distractors", () => {
      const target = mockWords[0]; // 吃 (verb, transitive)
      const rng = () => 0.5;

      const result = pickDistractors(target, mockWords, rng, 3);

      expect(result).toHaveLength(3);
    });

    it("never returns the target word itself", () => {
      const target = mockWords[0]; // 吃
      const rng = () => 0.5;

      const result = pickDistractors(target, mockWords, rng, 3);

      expect(result.every((w) => w.term !== target.term)).toBe(true);
    });

    it("prefers POS-matched words when available", () => {
      const target = mockWords[0]; // 吃 (verb, transitive)
      const rng = () => 0.5;

      const result = pickDistractors(target, mockWords, rng, 2);

      // Should pick other verbs first (喝, 睡, 走) before nouns
      expect(result.every((w) => (w.pos || []).some((p) => ["verb", "transitive"].includes(p)))).toBe(true);
    });

    it("falls back to random when POS pool is thin", () => {
      const target = mockWords[4]; // 学生 (noun)
      const rng = () => 0.5;

      // Only 2 other nouns available (老师, proper nouns don't match "noun")
      // Asking for 3 should require a fallback
      const result = pickDistractors(target, mockWords, rng, 3);

      expect(result).toHaveLength(3);
      expect(result.every((w) => w.term !== target.term)).toBe(true);
    });

    it("returns empty array if pool is empty", () => {
      const target = mockWords[0];
      const result = pickDistractors(target, [], () => 0.5, 3);
      expect(result).toEqual([]);
    });

    it("returns subset if pool smaller than request", () => {
      const target = mockWords[0];
      const smallPool = [mockWords[1], mockWords[2]];
      const result = pickDistractors(target, smallPool, () => 0.5, 3);

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("is deterministic with seeded RNG", () => {
      const target = mockWords[0];
      const seed = 12345;
      const makeRng = (s: number) => {
        let a = s >>> 0;
        return () => {
          a |= 0;
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };

      const rng1 = makeRng(seed);
      const result1 = pickDistractors(target, mockWords, rng1, 3);

      const rng2 = makeRng(seed);
      const result2 = pickDistractors(target, mockWords, rng2, 3);

      expect(result1.map((w) => w.term)).toEqual(result2.map((w) => w.term));
    });

    it("deduplicates results", () => {
      const target = mockWords[0];
      const rng = () => 0.5; // Fixed seed may pick same item twice

      const result = pickDistractors(target, mockWords, rng, 3);

      const terms = new Set(result.map((w) => w.term));
      expect(terms.size).toBe(result.length); // All unique
    });

    it("handles target with no POS tags", () => {
      const target: NinjaWord = { wordId: "test", term: "test", translation: "test" }; // no pos
      const result = pickDistractors(target, mockWords, () => 0.5, 3);

      expect(result).toHaveLength(3);
      expect(result.every((w) => w.term !== target.term)).toBe(true);
    });

    it("handles distractors with no POS tags", () => {
      const target = mockWords[0];
      const poolWithoutPos: NinjaWord[] = [
        { wordId: "x", term: "x", translation: "x" },
        mockWords[1],
      ];

      const result = pickDistractors(target, poolWithoutPos, () => 0.5, 2);

      expect(result).toHaveLength(2);
    });
  });

  describe("pickDistractors — frequency-matched", () => {
    // Ranks spread widely on purpose: proximity should clearly dominate
    // over POS in this pool (吃 rank 50, closest peers are 55 and 300, not
    // the POS-matched 睡/走 sitting out at 900/1200).
    const freqWords: NinjaWord[] = [
      { wordId: "1", term: "吃", translation: "eat", pos: ["verb"], frequencyRank: 50 },
      { wordId: "2", term: "喝", translation: "drink", pos: ["noun"], frequencyRank: 55 },
      { wordId: "3", term: "睡", translation: "sleep", pos: ["verb"], frequencyRank: 900 },
      { wordId: "4", term: "走", translation: "walk", pos: ["verb"], frequencyRank: 1200 },
      { wordId: "5", term: "书", translation: "book", pos: ["noun"], frequencyRank: 60 },
      { wordId: "6", term: "国", translation: "country", pos: ["noun"], frequencyRank: 8000 },
    ];

    it("prefers frequency-close words over POS-matched-but-distant words", () => {
      const target = freqWords[0]; // 吃, rank 50, verb
      const result = pickDistractors(target, freqWords, () => 0, 2);

      // 喝 (55) and 书 (60) are the two closest ranks — neither is a verb.
      expect(result.map((w) => w.term).sort()).toEqual(["书", "喝"]);
    });

    it("never returns the target itself", () => {
      const target = freqWords[0];
      const result = pickDistractors(target, freqWords, () => 0.3, 3);
      expect(result.every((w) => w.term !== target.term)).toBe(true);
    });

    it("is deterministic with a seeded RNG", () => {
      const target = freqWords[0];
      const makeRng = (s: number) => {
        let a = s >>> 0;
        return () => {
          a |= 0;
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };
      const result1 = pickDistractors(target, freqWords, makeRng(42), 3);
      const result2 = pickDistractors(target, freqWords, makeRng(42), 3);
      expect(result1.map((w) => w.term)).toEqual(result2.map((w) => w.term));
    });

    it("falls back to POS-primary picking when the target has no frequencyRank", () => {
      const target: NinjaWord = { wordId: "x", term: "x", translation: "x", pos: ["verb"] };
      const result = pickDistractors(target, freqWords, () => 0.5, 2);
      // Same code path as the POS-only tests above — just proving the
      // frequencyRank-present branch isn't taken when target lacks one.
      expect(result).toHaveLength(2);
      expect(result.every((w) => w.term !== "x")).toBe(true);
    });

    it("thin pool: returns fewer than requested rather than padding with duplicates", () => {
      const target = freqWords[0];
      const thinPool = [freqWords[1]]; // only one other word available
      const result = pickDistractors(target, thinPool, () => 0.5, 3);
      expect(result).toHaveLength(1);
      expect(result[0].term).toBe("喝");
    });

    it("thin pool: mixes ranked and unranked candidates without crashing", () => {
      const target = freqWords[0];
      const mixedPool: NinjaWord[] = [
        freqWords[1], // ranked, close
        { wordId: "u1", term: "未", translation: "unranked", pos: ["verb"] }, // no rank
      ];
      const result = pickDistractors(target, mixedPool, () => 0.5, 2);
      expect(result).toHaveLength(2);
      const terms = new Set(result.map((w) => w.term));
      expect(terms.size).toBe(2); // unique
    });
  });
});
