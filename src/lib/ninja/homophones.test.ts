import { describe, it, expect, beforeEach } from "vitest";
import {
  buildHomophoneGroups,
  pickHomophoneWave,
  pickListenWaveTarget,
  getHomophonePrompt,
  type HomophoneGroup,
} from "./homophones";
import type { NinjaWord } from "./distractors";

const MOCK_WORDS: NinjaWord[] = [
  // 机 (jī) group — tone 1
  { wordId: "1", term: "机", translation: "machine", phonetic: "jī", pos: ["noun"] },
  { wordId: "2", term: "激", translation: "excite", phonetic: "jī", pos: ["verb"] },
  { wordId: "3", term: "极", translation: "extreme", phonetic: "jí", pos: ["adjective"] },
  { wordId: "4", term: "迹", translation: "trace", phonetic: "jì", pos: ["noun"] },
  { wordId: "5", term: "既", translation: "already", phonetic: "jì", pos: ["adverb"] },
  // 建 (jiàn) group — tone 4
  { wordId: "6", term: "建", translation: "build", phonetic: "jiàn", pos: ["verb"] },
  { wordId: "7", term: "舰", translation: "warship", phonetic: "jiàn", pos: ["noun"] },
  { wordId: "8", term: "贱", translation: "cheap", phonetic: "jiàn", pos: ["adjective"] },
  { wordId: "9", term: "践", translation: "practice", phonetic: "jiàn", pos: ["verb"] },
  // Multi-char words (should be ignored)
  { wordId: "10", term: "机会", translation: "opportunity", phonetic: "jī huì", pos: ["noun"] },
  // Non-CJK chars (should be ignored)
  { wordId: "11", term: "abc", translation: "test", phonetic: "yī èr sān", pos: ["noun"] },
  // Missing phonetic (should be ignored)
  { wordId: "12", term: "字", translation: "character", phonetic: "", pos: ["noun"] },
];

describe("homophone groups", () => {
  describe("buildHomophoneGroups()", () => {
    it("builds groups only from single-character words", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      // "ji" group has 5 members (jī, jī, jí, jì, jì) — should be included
      expect(groups.has("ji")).toBe(true);
      // "jian" group has 4 members — should be included (≥4)
      expect(groups.has("jian")).toBe(true);
    });

    it("ignores multi-character words", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      // "ji hui" should not create a group
      expect(groups.has("ji hui")).toBe(false);
    });

    it("ignores words with missing phonetic", () => {
      const words: NinjaWord[] = [
        { wordId: "1", term: "字", translation: "character", phonetic: "", pos: ["noun"] },
      ];
      const groups = buildHomophoneGroups(words);
      expect(groups.size).toBe(0);
    });

    it("filters out groups with < 4 members", () => {
      const words: NinjaWord[] = [
        { wordId: "1", term: "妈", translation: "mother", phonetic: "mā", pos: ["noun"] },
        { wordId: "2", term: "麻", translation: "hemp", phonetic: "má", pos: ["noun"] },
        // Only 2 different tones, so group has 2 members — should be filtered
      ];
      const groups = buildHomophoneGroups(words);
      expect(groups.size).toBe(0);
    });

    it("groups words by tone-less pronunciation", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const jiGroup = groups.get("ji");
      expect(jiGroup).toBeDefined();
      expect(jiGroup?.members.length).toBe(5);
    });

    it("organizes members by tone within group", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const jiGroup = groups.get("ji");
      expect(jiGroup?.byTone[1].length).toBe(2); // jī, jī
      expect(jiGroup?.byTone[2].length).toBe(1); // jí
      expect(jiGroup?.byTone[4].length).toBe(2); // jì, jì
      expect(jiGroup?.byTone[3].length).toBe(0); // none
      expect(jiGroup?.byTone[5].length).toBe(0); // none
    });

    it("handles empty word list", () => {
      const groups = buildHomophoneGroups([]);
      expect(groups.size).toBe(0);
    });
  });

  describe("pickHomophoneWave()", () => {
    let jiGroup: HomophoneGroup;
    let jianGroup: HomophoneGroup;

    beforeEach(() => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      jiGroup = groups.get("ji")!;
      jianGroup = groups.get("jian")!;
    });

    it("picks words from a specific tone", () => {
      const rng = () => 0.5; // Simple deterministic RNG
      const wave = pickHomophoneWave(jiGroup, 1, false, 2, rng);
      expect(wave.length).toBeGreaterThanOrEqual(1);
      expect(wave.length).toBeLessThanOrEqual(2);
      // All picked words should be tone 1 (jī)
      for (const word of wave) {
        expect(word.phonetic).toMatch(/^jī$/);
      }
    });

    it("picks up to `size` words", () => {
      const rng = () => 0.5;
      const wave = pickHomophoneWave(jiGroup, 1, false, 3, rng);
      expect(wave.length).toBeLessThanOrEqual(3);
    });

    it("excludes a specific tone when excludeTone=true", () => {
      const rng = () => 0.5;
      const wave = pickHomophoneWave(jiGroup, 1, true, 5, rng);
      // Should pick from tones 2, 3, 4, 5 (not tone 1)
      for (const word of wave) {
        expect(word.phonetic).not.toMatch(/^jī$/);
      }
    });

    it("handles tone with no members", () => {
      const rng = () => 0.5;
      // Tone 3 (caron) has no members in jiGroup
      const wave = pickHomophoneWave(jiGroup, 3, false, 5, rng);
      expect(wave.length).toBe(0);
    });

    it("returns fewer words than size if not enough candidates", () => {
      const rng = () => 0.5;
      // jianGroup has 4 members, all tone 4; request 10
      const wave = pickHomophoneWave(jianGroup, 4, false, 10, rng);
      expect(wave.length).toBeLessThanOrEqual(4);
    });

    it("is deterministic with seeded RNG", () => {
      const seededRng = (seed: number) => {
        return () => {
          seed = (seed * 1103515245 + 12345) % 2147483648;
          return seed / 2147483648;
        };
      };

      const rng1 = seededRng(42);
      const rng2 = seededRng(42);

      const wave1 = pickHomophoneWave(jiGroup, 2, false, 3, rng1);
      const wave2 = pickHomophoneWave(jiGroup, 2, false, 3, rng2);

      expect(wave1.map((w) => w.wordId)).toEqual(wave2.map((w) => w.wordId));
    });

    it("handles exclude-all-others case", () => {
      const rng = () => 0.5;
      // Exclude tone 4 — should pick from tones 1, 2, 3, 5
      const wave = pickHomophoneWave(jiGroup, 4, true, 5, rng);
      for (const word of wave) {
        expect(word.phonetic).not.toMatch(/^jì$/);
      }
    });
  });

  describe("pickListenWaveTarget()", () => {
    it("returns null when there are no eligible groups", () => {
      const result = pickListenWaveTarget(new Map(), () => 0.5, 4);
      expect(result).toBeNull();
    });

    it("picks a target and distractors that all share the target's toneless pronunciation", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      // rng()=>0 deterministically lands on the "ji" group (index 0) — the
      // "jian" group is all tone 4, so excluding the target's own tone
      // would leave no distractors and legitimately return null. See the
      // dedicated null-case test below for that.
      const rng = () => 0;
      const result = pickListenWaveTarget(groups, rng, 4);
      expect(result).not.toBeNull();
      const { target, distractors } = result!;
      const targetToneless = target.phonetic!.normalize("NFD").replace(/[́̀̌̄]/g, "");
      for (const d of distractors) {
        const dToneless = d.phonetic!.normalize("NFD").replace(/[́̀̌̄]/g, "");
        expect(dToneless.normalize("NFC")).toBe(targetToneless.normalize("NFC"));
      }
    });

    it("never returns the target as one of its own distractors", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const result = pickListenWaveTarget(groups, () => 0, 4);
      expect(result).not.toBeNull();
      const { target, distractors } = result!;
      expect(distractors.some((d) => d.wordId === target.wordId)).toBe(false);
    });

    it("a wave never mixes in a tile matching the target's own tone", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const result = pickListenWaveTarget(groups, () => 0, 4);
      expect(result).not.toBeNull();
      const { target, distractors } = result!;
      const targetTone = target.phonetic!.normalize("NFD").match(/[́̀̌̄]/)?.[0];
      for (const d of distractors) {
        const dTone = d.phonetic!.normalize("NFD").match(/[́̀̌̄]/)?.[0];
        expect(dTone).not.toBe(targetTone);
      }
    });

    it("caps distractors at waveSize - 1", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const result = pickListenWaveTarget(groups, () => 0, 3);
      expect(result).not.toBeNull();
      expect(result!.distractors.length).toBeLessThanOrEqual(2);
    });

    it("is deterministic with a seeded RNG", () => {
      const seededRng = (seed: number) => {
        return () => {
          seed = (seed * 1103515245 + 12345) % 2147483648;
          return seed / 2147483648;
        };
      };
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const result1 = pickListenWaveTarget(groups, seededRng(7), 4);
      const result2 = pickListenWaveTarget(groups, seededRng(7), 4);
      expect(result1?.target.wordId).toBe(result2?.target.wordId);
      expect(result1?.distractors.map((d) => d.wordId)).toEqual(
        result2?.distractors.map((d) => d.wordId)
      );
    });

    it("returns null when the only eligible group can't produce a distractor (single tone present)", () => {
      // jianGroup is all tone 4 — excluding tone 4 leaves nothing.
      const words: NinjaWord[] = [
        { wordId: "1", term: "建", translation: "build", phonetic: "jiàn", pos: ["verb"] },
        { wordId: "2", term: "舰", translation: "warship", phonetic: "jiàn", pos: ["noun"] },
        { wordId: "3", term: "贱", translation: "cheap", phonetic: "jiàn", pos: ["adjective"] },
        { wordId: "4", term: "践", translation: "practice", phonetic: "jiàn", pos: ["verb"] },
      ];
      const groups = buildHomophoneGroups(words);
      const result = pickListenWaveTarget(groups, () => 0.5, 4);
      expect(result).toBeNull();
    });
  });

  describe("getHomophonePrompt()", () => {
    it("generates prompt for specific tone (include)", () => {
      const prompt = getHomophonePrompt("ji", 1, false);
      expect(prompt).toContain("ji");
      expect(prompt).toContain("1st tone");
    });

    it("generates prompt for tone 2", () => {
      const prompt = getHomophonePrompt("jian", 2, false);
      expect(prompt).toContain("2nd tone");
    });

    it("generates prompt for tone 3", () => {
      const prompt = getHomophonePrompt("ma", 3, false);
      expect(prompt).toContain("3rd tone");
    });

    it("generates prompt for tone 4", () => {
      const prompt = getHomophonePrompt("qu", 4, false);
      expect(prompt).toContain("4th tone");
    });

    it("generates prompt for neutral tone", () => {
      const prompt = getHomophonePrompt("de", 5, false);
      expect(prompt).toContain("neutral");
    });

    it("generates exclusion prompt when excludeTone=true", () => {
      const prompt = getHomophonePrompt("ba", 2, true);
      expect(prompt).toContain("EXCEPT");
      expect(prompt).toContain("2nd tone");
    });

    it("includes toneless pronunciation in prompt", () => {
      const prompt = getHomophonePrompt("zhuang", 1, false);
      expect(prompt).toContain("zhuang");
    });
  });

  describe("integration with real data checks", () => {
    it("ji group contains correct tones", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const jiGroup = groups.get("ji")!;
      expect(Object.keys(jiGroup.byTone).length).toBe(5); // Has all 5 tone slots
    });

    it("jian group all members have same toneless", () => {
      const groups = buildHomophoneGroups(MOCK_WORDS);
      const jianGroup = groups.get("jian")!;
      for (const word of jianGroup.members) {
        expect(word.term).toMatch(/^[建舰贱践]$/);
      }
    });
  });
});
