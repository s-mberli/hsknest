import { describe, expect, it } from "vitest";
import { gradeTokens, ABOVE_LEVEL_LIMIT } from "../grade";
import { segmentText } from "../segment";
import { hydrateText } from "../hydrate";
import { toneMark } from "../cedict";
import { sentenceTokens, findSentenceForToken, sentenceSurface, findSentenceForMark } from "../sentences";
import type { HskLexicon } from "../lexicon";
import type { HydratedText, StoryToken } from "../types";

function lex(entries: Record<string, number>): HskLexicon {
  return new Map(Object.entries(entries));
}

function tok(partial: Partial<StoryToken>): StoryToken {
  return {
    s: 0,
    e: 1,
    w: "",
    py: null,
    lvl: null,
    senses: null,
    isPunct: false,
    sentence: 0,
    ...partial,
  };
}

describe("gradeTokens", () => {
  const target = 1;

  // These micro-token fixtures are far shorter than LENGTH_SPEC's floor, so
  // they exercise individual fields (aboveLevelPct, offList, ...) rather than
  // the overall verdict — length/at-level floor behavior is covered in its
  // own tests below, against realistically-sized token streams.

  it("computes zero above-level share when everything is at or below target", () => {
    const tokens = [tok({ w: "我", lvl: 1 }), tok({ w: "去", lvl: 1 }), tok({ w: "。", isPunct: true })];
    const r = gradeTokens(tokens, target);
    expect(r.aboveLevelPct).toBe(0);
  });

  it("flags on the above-level ceiling when the share exceeds the limit", () => {
    const tokens: StoryToken[] = [];
    // 19 at-level + 1 above-level of 20 word tokens = 5% → still under the ceiling
    for (let i = 0; i < 19; i++) tokens.push(tok({ w: `词${i}`, lvl: 1 }));
    tokens.push(tok({ w: "影碟", lvl: 6 }));
    expect(gradeTokens(tokens, target).aboveLevelPct).toBeLessThanOrEqual(ABOVE_LEVEL_LIMIT);

    tokens.push(tok({ w: "寡头", lvl: 7 })); // now 2/21 ≈ 9.5%
    const r = gradeTokens(tokens, target);
    expect(r.verdict).toBe("flag");
    expect(r.aboveLevelPct).toBeGreaterThan(ABOVE_LEVEL_LIMIT);
    expect(r.aboveLevel.map((x) => x.lemma)).toContain("寡头");
    expect(r.reasons.some((x) => x.includes("above HSK1"))).toBe(true);
  });

  it("counts off-list lemmas separately from above-level ones", () => {
    const tokens = [
      tok({ w: "我", lvl: 1 }),
      tok({ w: "阿萨姆", lvl: null }),
      tok({ w: "。", isPunct: true }),
    ];
    const r = gradeTokens(tokens, target);
    expect(r.offList).toEqual([{ lemma: "阿萨姆", count: 1 }]);
    expect(r.bandHistogram["off"]).toBe(1);
  });

  it("warns on at-target words repeated fewer than 3 times", () => {
    const tokens = [
      tok({ w: "咖啡", lvl: 1 }),
      tok({ w: "我", lvl: 1 }),
      tok({ w: "我", lvl: 1 }),
      tok({ w: "我", lvl: 1 }),
    ];
    const r = gradeTokens(tokens, target);
    expect(r.lowRepetition).toEqual([{ lemma: "咖啡", count: 1 }]);
  });

  it("reports sentence length stats skipping punctuation", () => {
    const tokens = [
      tok({ w: "我去", lvl: 1 }),
      tok({ w: "学校", lvl: 1 }),
      tok({ w: "。", isPunct: true }),
      tok({ w: "很好", lvl: 1 }),
      tok({ w: "！", isPunct: true }),
    ];
    const r = gradeTokens(tokens, target);
    expect(r.sentenceLength).toEqual({ avg: 3, max: 4 });
    expect(r.estimatedMin).toBeGreaterThanOrEqual(1);
  });

  // ── New floor gates (2026-08-21 content review) ──────────────────────────

  /** Build `count` distinct filler tokens at the given level, `每` repeated once each. */
  function fillerTokens(count: number, lvl: number, charsEach = 2): StoryToken[] {
    const out: StoryToken[] = [];
    for (let i = 0; i < count; i++) {
      out.push(tok({ w: `词${i}`.padEnd(charsEach, "字"), lvl }));
      out.push(tok({ w: "。", isPunct: true }));
    }
    return out;
  }

  it("flags a story with too few distinct at-level lemmas (mislabeled too easy)", () => {
    // HSK3 target, but only 2 distinct HSK3 words padded out with HSK1 filler
    // to clear the length floor — mirrors the real buying-apples.md defect.
    const tokens = [
      ...fillerTokens(120, 1, 3), // plenty of HSK1 filler, well past the 400-char floor
      tok({ w: "苹果", lvl: 3 }),
      tok({ w: "斤", lvl: 3 }),
      tok({ w: "。", isPunct: true }),
    ];
    const r = gradeTokens(tokens, 3);
    expect(r.atLevelUnique).toBe(2);
    expect(r.verdict).toBe("flag");
    expect(r.reasons.some((x) => x.includes("distinct HSK3 words"))).toBe(true);
  });

  it("passes the at-level floor when enough distinct HSK-band lemmas are present", () => {
    const tokens = fillerTokens(15, 3, 3); // 15 distinct HSK3 words, well past MIN_AT_LEVEL_LEMMAS[3]=10
    const r = gradeTokens(tokens, 3);
    expect(r.atLevelUnique).toBe(15);
    expect(r.reasons.some((x) => x.includes("distinct HSK3 words"))).toBe(false);
  });

  it("exempts HSK1 from the at-level floor", () => {
    // Only 1 distinct HSK1 word, well under any other level's floor, but
    // level 1 has MIN_AT_LEVEL_LEMMAS = 0 — no floor to fail.
    const tokens = [
      tok({ w: "我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我我", lvl: 1 }),
      tok({ w: "。", isPunct: true }),
    ];
    const r = gradeTokens(tokens, 1);
    expect(r.atLevelUnique).toBe(1);
    expect(r.reasons.some((x) => x.includes("distinct HSK1 words"))).toBe(false);
  });

  it("flags a story shorter than its level's length floor", () => {
    const tokens = fillerTokens(15, 3, 3); // same at-level content as the passing case above
    const short = tokens.slice(0, 6); // trim well under HSK3's 400-char floor
    const r = gradeTokens(short, 3);
    expect(r.chars).toBeLessThan(400);
    expect(r.verdict).toBe("flag");
    expect(r.reasons.some((x) => x.includes("below the HSK3 length floor"))).toBe(true);
  });

  it("flags a story longer than its level's length ceiling", () => {
    const tokens = fillerTokens(150, 1, 3); // 150 * 3 = 450 chars, over HSK1's 200-char ceiling
    const r = gradeTokens(tokens, 1);
    expect(r.chars).toBeGreaterThan(200);
    expect(r.verdict).toBe("flag");
    expect(r.reasons.some((x) => x.includes("above the HSK1 length ceiling"))).toBe(true);
  });

  it("passes all three gates together for a realistically-sized on-level story", () => {
    const tokens = fillerTokens(60, 3, 7); // 60 distinct HSK3 lemmas × 7 chars = 420 CJK chars, within 400-800
    const r = gradeTokens(tokens, 3);
    expect(r.verdict).toBe("pass");
    expect(r.reasons).toEqual([]);
  });
});

describe("segmentText", () => {
  it("merges compounds and attaches context pinyin", () => {
    const text = "我去咖啡店。";
    const { tokens, sentences } = segmentText(text, { lexicon: lex({ 我去: 1, 咖啡店: 2 }) });
    const surfaces = tokens.map((t) => t.w);
    expect(surfaces).toEqual(["我去", "咖啡店", "。"]);
    const coffee = tokens[1];
    expect(coffee.py).toBe("kā fēi diàn");
    expect(coffee.lvl).toBe(2);
    expect(tokens[2].isPunct).toBe(true);
    expect(sentences).toEqual([{ t0: 0, t1: 3 }]);
    // char offsets must slice back to the surface
    expect(text.slice(coffee.s, coffee.e)).toBe("咖啡店");
  });

  it("resolves polyphones from context", () => {
    const { tokens } = segmentText("我在银行工作。", { lexicon: new Map() });
    const xing = tokens.find((t) => t.w === "银行");
    expect(xing?.py).toContain("háng");
  });

  it("applies 一 tone sandhi from context", () => {
    const { tokens } = segmentText("我买一杯茶。", { lexicon: new Map() });
    const yi = tokens.find((t) => t.w === "一杯");
    expect(yi?.py).toBe("yì bēi");
  });

  it("groups multiple sentences with correct spans", () => {
    const text = "你好。我是小明！";
    const { tokens, sentences } = segmentText(text, { lexicon: new Map() });
    expect(sentences.length).toBe(2);
    const [a, b] = sentences;
    expect(tokens[a.t1 - 1].w).toBe("。");
    expect(tokens[b.t1 - 1].w).toBe("！");
  });

  it("attaches cedict senses when provided", () => {
    const cedict = { 咖啡: [["kā fēi", ["coffee"]]] } as never;
    const { tokens } = segmentText("咖啡好喝。", { lexicon: new Map(), cedict });
    const coffee = tokens.find((t) => t.w === "咖啡");
    expect(coffee?.senses).toEqual([{ pinyin: "kā fēi", meanings: ["coffee"] }]);
  });

  it("keeps trailing text without terminal punctuation as its own sentence", () => {
    const { sentences } = segmentText("好。没有句号", { lexicon: new Map() });
    expect(sentences.length).toBe(2);
  });

  it("merges a closing quote before a paragraph break into the same sentence", () => {
    // Mirrors real story markdown: dialogue paragraph ends "。”" immediately
    // before the blank-line paragraph break, which is itself sentence-ending
    // (SENTENCE_END matches \n) — this is what orphans the "”" pre-fix.
    const { tokens, sentences } = segmentText(
      "他说：“谢谢。”\n\n我笑了。",
      { lexicon: new Map() }
    );
    expect(sentences.length).toBe(2);
    const surface = (s: number) =>
      tokens
        .slice(sentences[s].t0, sentences[s].t1)
        .map((t) => t.w)
        .join("");
    expect(surface(0)).toBe("他说：“谢谢。”\n\n");
    expect(surface(1)).toBe("我笑了。");
  });

  it("merges a closing quote at the very end of the text (no trailing sentence)", () => {
    const { tokens, sentences } = segmentText("他说：“谢谢。”", {
      lexicon: new Map(),
    });
    expect(sentences.length).toBe(1);
    const surface = tokens.map((t) => t.w).join("");
    expect(surface).toBe("他说：“谢谢。”");
  });

  it("keeps token.sentence in sync with the final (merged) sentence spans", () => {
    const { tokens, sentences } = segmentText(
      "他说：“谢谢。”我笑了",
      { lexicon: new Map() }
    );
    for (let ti = 0; ti < tokens.length; ti++) {
      const si = sentences.findIndex((s) => ti >= s.t0 && ti < s.t1);
      expect(si).toBeGreaterThanOrEqual(0);
      expect(tokens[ti].sentence).toBe(si);
    }
  });
});

// ── toneMark ────────────────────────────────────────────────────────────────

describe("toneMark", () => {
  it("converts numbered pinyin to tone marks", () => {
    expect(toneMark("ni3 hao3")).toBe("nǐ hǎo");
  });

  it("handles single syllable", () => {
    expect(toneMark("ma1")).toBe("mā");
  });

  it("returns original on failure", () => {
    expect(toneMark("???")).toBe("???");
  });
});

// ── hydrateText ─────────────────────────────────────────────────────────────

describe("hydrateText", () => {
  it("assigns English translations to sentences by paragraph", () => {
    const body = "你好世界。\n\n我很高兴。";
    const { hydrated } = hydrateText(body, new Map(), null, 1, ["Hello world.", "I am happy."]);
    // segmenter may split further; key assertion is that EN is assigned
    expect(hydrated.sentences.some((s) => s.en === "Hello world.")).toBe(true);
    expect(hydrated.sentences.some((s) => s.en === "I am happy.")).toBe(true);
  });

  it("handles single paragraph with multiple sentences", () => {
    const body = "你好。世界。";
    const { hydrated } = hydrateText(body, new Map(), null, 1, ["Hello world."]);
    expect(hydrated.sentences.length).toBeGreaterThanOrEqual(2);
    expect(hydrated.sentences[0].en).toBe("Hello world.");
  });

  it("returns word counts from segmenter", () => {
    const body = "你好世界。";
    const { hydrated } = hydrateText(body, new Map(), null, 1);
    expect(hydrated.words.total).toBeGreaterThan(0);
    expect(hydrated.words.unique).toBeGreaterThan(0);
  });
});

// ── sentence helpers ────────────────────────────────────────────────────────

function makeDoc(tokens: StoryToken[], sentences: { t0: number; t1: number }[]): HydratedText {
  return {
    v: 1,
    chars: 100,
    tokens,
    sentences: sentences.map((s) => ({ ...s })),
    words: { total: tokens.filter((t) => !t.isPunct).length, unique: new Set(tokens.filter((t) => !t.isPunct).map((t) => t.w)).size },
  };
}

describe("sentence helpers", () => {
  const doc = makeDoc(
    [
      tok({ w: "我", s: 0, e: 1 }),
      tok({ w: "去", s: 1, e: 2 }),
      tok({ w: "。", s: 2, e: 3, isPunct: true }),
      tok({ w: "很好", s: 3, e: 5 }),
      tok({ w: "！", s: 5, e: 6, isPunct: true }),
    ],
    [{ t0: 0, t1: 3 }, { t0: 3, t1: 5 }]
  );

  it("sentenceTokens returns correct slice", () => {
    const s0 = sentenceTokens(doc, 0);
    expect(s0.map((t) => t.w)).toEqual(["我", "去", "。"]);
    const s1 = sentenceTokens(doc, 1);
    expect(s1.map((t) => t.w)).toEqual(["很好", "！"]);
  });

  it("sentenceTokens returns [] for invalid index", () => {
    expect(sentenceTokens(doc, 99)).toEqual([]);
  });

  it("findSentenceForToken finds correct sentence", () => {
    const token = doc.tokens[0]; // "我"
    expect(findSentenceForToken(doc, token)).toBe(0);
    const token2 = doc.tokens[3]; // "很好"
    expect(findSentenceForToken(doc, token2)).toBe(1);
  });

  it("sentenceSurface joins surfaces", () => {
    expect(sentenceSurface(doc, 0)).toBe("我去。");
    expect(sentenceSurface(doc, 1)).toBe("很好！");
  });

  it("findSentenceForMark finds sentence containing mark char range", () => {
    expect(findSentenceForMark(doc, { s: 0, e: 2 })).toBe(0); // "我去"
    expect(findSentenceForMark(doc, { s: 3, e: 5 })).toBe(1); // "很好"
  });
});
