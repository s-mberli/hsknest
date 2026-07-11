import { describe, expect, it } from "vitest";

import { segment, selectSentences } from "../sentenceBuild";

const vocab = new Map<string, number>([
  ["我", 1],
  ["你", 1],
  ["爱", 1],
  ["喜欢", 1],
  ["中国", 2],
  ["中国人", 3],
  ["是", 1],
]);

describe("segment", () => {
  it("matches longest terms first and returns distinct matches", () => {
    expect(segment("我是中国人。", vocab, 3)).toEqual(["我", "是", "中国人"]);
  });

  it("ignores punctuation, digits, and latin text", () => {
    expect(segment("我喜欢你！ 100%", vocab, 3)).toEqual(["我", "喜欢", "你"]);
  });

  it("rejects sentences with out-of-vocabulary words", () => {
    expect(segment("我喜欢猫。", vocab, 3)).toBeNull();
  });

  it("rejects sentences with no vocabulary content at all", () => {
    expect(segment("123!", vocab, 3)).toBeNull();
  });
});

describe("selectSentences", () => {
  const pair = (text: string, translation = "x") => ({
    text,
    translation,
    source: "tatoeba.org #1 (a) & #2 (b)",
  });

  it("keeps covered sentences, shortest first, stamped with the max level", () => {
    const out = selectSentences([pair("我是中国人。"), pair("我爱你。"), pair("我喜欢猫。")], vocab);
    expect(out.map((s) => s.text)).toEqual(["我爱你。", "我是中国人。"]);
    expect(out[1].metadata.level).toBe(3);
    expect(out[1].terms).toContain("中国人");
  });

  it("caps sentences per word", () => {
    const pairs = ["我爱你。", "你爱我。", "我爱你！", "你爱你。", "我爱我。"].map((t) => pair(t));
    const out = selectSentences(pairs, new Map([["我", 1], ["你", 1], ["爱", 1]]), { perWord: 2 });
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it("dedupes identical sentence text and respects the total cap", () => {
    const out = selectSentences([pair("我爱你。"), pair("我爱你。"), pair("你爱我。")], vocab, { total: 1 });
    expect(out).toHaveLength(1);
  });
});
