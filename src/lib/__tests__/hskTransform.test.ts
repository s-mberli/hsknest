import { describe, expect, it } from "vitest";

import {
  buildFrequencyList,
  buildLevel,
  buildMeanings,
  buildTranslation,
  cleanGlosses,
  transformEntry,
  type RawEntry,
} from "../hskTransform";

const LE: RawEntry = {
  simplified: "了",
  level: ["new-1", "old-1"],
  frequency: 3,
  pos: ["y", "u", "v"],
  forms: [
    {
      traditional: "了",
      transcriptions: { pinyin: "le" },
      meanings: [
        "(completed action marker)",
        "(modal particle indicating change of state, situation now)",
        "(modal particle intensifying preceding clause)",
      ],
    },
    {
      traditional: "了",
      transcriptions: { pinyin: "liǎo" },
      meanings: ["to finish", "to achieve", "variant of 了", "to understand clearly"],
    },
  ],
};

describe("cleanGlosses", () => {
  it("drops cross-reference noise", () => {
    expect(cleanGlosses(["to finish", "variant of 了", "old variant of 喜"])).toEqual([
      "to finish",
    ]);
  });

  it("drops surname senses when real senses exist", () => {
    expect(cleanGlosses(["surname Zhang", "to open"])).toEqual(["to open"]);
  });

  it("keeps surname senses when nothing else is left", () => {
    expect(cleanGlosses(["surname Zhang"])).toEqual(["surname Zhang"]);
  });
});

describe("buildTranslation", () => {
  it("joins at most three short senses", () => {
    expect(buildTranslation(["a", "b", "c", "d"])).toBe("a; b; c");
  });

  it("stops before exceeding the length budget but always keeps one", () => {
    const long = "x".repeat(80);
    expect(buildTranslation([long, "short"])).toBe(long);
  });
});

describe("buildMeanings", () => {
  it("tags secondary-form senses with their reading and dedupes", () => {
    const meanings = buildMeanings(LE.forms);
    expect(meanings[0]).toEqual({ gloss: "(completed action marker)" });
    const liao = meanings.filter((m) => m.reading === "liǎo");
    expect(liao.map((m) => m.gloss)).toEqual([
      "to finish",
      "to achieve",
      "to understand clearly",
    ]);
  });
});

describe("transformEntry", () => {
  it("produces a card-friendly seed word with structured meanings", () => {
    const word = transformEntry(LE, 1);
    expect(word.term).toBe("了");
    expect(word.phonetic).toBe("le");
    expect(word.translation).toBe("(completed action marker)");
    expect(word.metadata.level).toBe(1);
    expect(word.metadata.frequencyRank).toBe(3);
    expect(word.metadata.traditional).toBeUndefined();
    expect(word.metadata.meanings.length).toBeGreaterThan(3);
  });

  it("records traditional only when it differs", () => {
    const rang: RawEntry = {
      simplified: "让",
      level: ["new-2"],
      frequency: 54,
      pos: ["v"],
      forms: [
        {
          traditional: "讓",
          transcriptions: { pinyin: "ràng" },
          meanings: ["to yield", "to permit"],
        },
      ],
    };
    expect(transformEntry(rang, 2).metadata.traditional).toBe("讓");
  });
});

describe("buildLevel / buildFrequencyList", () => {
  const data: RawEntry[] = [
    LE,
    {
      simplified: "让",
      level: ["new-2"],
      frequency: 54,
      pos: ["v"],
      forms: [
        {
          traditional: "讓",
          transcriptions: { pinyin: "ràng" },
          meanings: ["to yield"],
        },
      ],
    },
    {
      simplified: "冷门",
      level: ["new-1"],
      pos: ["n"],
      forms: [
        {
          traditional: "冷門",
          transcriptions: { pinyin: "lěngmén" },
          meanings: ["unexpected"],
        },
      ],
    },
  ];

  it("filters by level tag and orders by frequency, unknowns last", () => {
    const level1 = buildLevel(data, 1);
    expect(level1.map((w) => w.term)).toEqual(["了", "冷门"]);
  });

  it("takes the top N ranked words for frequency lists at level 0", () => {
    const freq = buildFrequencyList(data, 1);
    expect(freq).toHaveLength(1);
    expect(freq[0].term).toBe("了");
    expect(freq[0].metadata.level).toBe(0);
  });
});
