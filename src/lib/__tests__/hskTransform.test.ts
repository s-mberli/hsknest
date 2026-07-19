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

// Dictionary-style entry that leads with the proper-noun reading (real shape
// of 三 in complete-hsk-vocabulary): the surname form must NOT win the card.
const SAN: RawEntry = {
  simplified: "三",
  level: ["new-1"],
  frequency: 233,
  pos: ["m", "t"],
  forms: [
    {
      traditional: "三",
      transcriptions: { pinyin: "Sān" },
      meanings: ["surname San"],
    },
    {
      traditional: "三",
      transcriptions: { pinyin: "sān" },
      meanings: ["three", "3"],
    },
  ],
};

describe("surname-first entries", () => {
  it("promotes the ordinary form to primary (phonetic + translation)", () => {
    const word = transformEntry(SAN, 1);
    expect(word.phonetic).toBe("sān");
    expect(word.translation).toBe("three; 3");
  });

  it("sorts surname senses last in meanings", () => {
    const meanings = buildMeanings(SAN.forms);
    expect(meanings.map((m) => m.gloss)).toEqual(["three", "3", "surname San"]);
    expect(meanings[2].reading).toBe("Sān");
  });
});

// Real complete-hsk-vocabulary shape: a lone marginal/archaic-tagged sense
// sorts first in the source data, ahead of the everyday reading — the bug
// found live (说 spoke as "shuì" — "to persuade" — instead of "shuō").
const SHUO: RawEntry = {
  simplified: "说",
  level: ["new-1"],
  frequency: 60,
  pos: ["v"],
  forms: [
    { traditional: "說", transcriptions: { pinyin: "shuì" }, meanings: ["to persuade"] },
    {
      traditional: "說",
      transcriptions: { pinyin: "shuō" },
      meanings: ["to speak", "to talk", "to say"],
    },
  ],
};

// 教: BOTH readings are ordinary, commonly-taught senses (jiāo "to teach" vs
// jiào "religion"/"teaching") — must NOT be reordered by the pinyin tiebreak,
// and the surname form (present in the real dataset) must still demote.
const JIAO: RawEntry = {
  simplified: "教",
  level: ["new-1"],
  frequency: 100,
  pos: ["v", "n"],
  forms: [
    { traditional: "教", transcriptions: { pinyin: "Jiào" }, meanings: ["surname Jiao"] },
    { traditional: "教", transcriptions: { pinyin: "jiāo" }, meanings: ["to teach"] },
    {
      traditional: "教",
      transcriptions: { pinyin: "jiào" },
      meanings: ["religion", "teaching", "to make"],
    },
  ],
};

// 只: two forms SHARE a reading (zhī) but one is the common classifier sense
// and the other is an obscure botanical sense — the pinyin tiebreak can't
// distinguish them by reading alone, so the dataset's own order must hold.
const ZHI: RawEntry = {
  simplified: "只",
  level: ["new-2"],
  frequency: 50,
  pos: ["d", "q"],
  forms: [
    { traditional: "只", transcriptions: { pinyin: "zhǐ" }, meanings: ["only", "merely", "just"] },
    {
      traditional: "只",
      transcriptions: { pinyin: "zhī" },
      meanings: ["grain that has begun to ripen"],
    },
    {
      traditional: "隻",
      transcriptions: { pinyin: "zhī" },
      meanings: ["classifier for birds and certain animals"],
    },
  ],
};

describe("rare-reading-first entries (pinyin tiebreak)", () => {
  it("promotes the everyday reading over a lone marginal-sense form", () => {
    const word = transformEntry(SHUO, 1);
    expect(word.phonetic).toBe("shuō");
    expect(word.translation).toBe("to speak; to talk; to say");
  });

  it("still demotes a surname form even when the term is on the preserve list", () => {
    const word = transformEntry(JIAO, 1);
    expect(word.phonetic).toBe("jiāo");
    expect(word.translation).toBe("to teach");
  });

  it("does not reorder genuine dual-reading words toward the dictionary default", () => {
    const word = transformEntry(JIAO, 1);
    const meanings = buildMeanings(JIAO.forms, "教");
    expect(meanings[0]).toEqual({ gloss: "to teach" });
    expect(meanings.some((m) => m.gloss === "religion" && m.reading === "jiào")).toBe(true);
    expect(word.metadata.meanings.at(-1)?.gloss).toBe("surname Jiao");
  });

  it("preserves dataset order when forms share a reading but differ in commonness", () => {
    const word = transformEntry(ZHI, 2);
    expect(word.phonetic).toBe("zhǐ");
    expect(word.translation).toBe("only; merely; just");
  });
});

describe("surname-first entries", () => {
  it("caps stored meanings at 8", () => {
    const many: RawEntry["forms"] = [
      {
        traditional: "x",
        transcriptions: { pinyin: "x" },
        meanings: Array.from({ length: 12 }, (_, i) => `sense ${i}`),
      },
    ];
    expect(buildMeanings(many)).toHaveLength(8);
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
