import { describe, expect, it } from "vitest";

import { parseDelimited } from "@/lib/import";

describe("parseDelimited", () => {
  it("parses tab-separated term/translation rows", () => {
    const { words, skipped } = parseDelimited("你好\thello\n谢谢\tthank you");
    expect(skipped).toBe(0);
    expect(words).toEqual([
      { term: "你好", translation: "hello", phonetic: null, meanings: null },
      { term: "谢谢", translation: "thank you", phonetic: null, meanings: null },
    ]);
  });

  it("auto-detects comma delimiter when no tabs present", () => {
    const { words } = parseDelimited("hola,hello,ˈo.la");
    expect(words).toEqual([
      { term: "hola", translation: "hello", phonetic: "ˈo.la", meanings: null },
    ]);
  });

  it("prefers tab in auto mode when both are present", () => {
    // Comma stays part of the translation because the row is tab-delimited.
    const { words } = parseDelimited("term\ta, b, c");
    expect(words).toEqual([
      { term: "term", translation: "a, b, c", phonetic: null, meanings: null },
    ]);
  });

  it("honors an explicit comma delimiter", () => {
    const { words } = parseDelimited("a,b\tc", { delimiter: "comma" });
    expect(words).toEqual([{ term: "a", translation: "b\tc", phonetic: null, meanings: null }]);
  });

  it("handles quoted fields with embedded delimiters and newlines", () => {
    const text = '"hello, world","a greeting\nwith a newline"';
    const { words } = parseDelimited(text, { delimiter: "comma" });
    expect(words).toEqual([
      {
        term: "hello, world",
        translation: "a greeting\nwith a newline",
        phonetic: null, meanings: null,
      },
    ]);
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    const { words } = parseDelimited('"say ""hi""",greeting', {
      delimiter: "comma",
    });
    expect(words[0].term).toBe('say "hi"');
    expect(words[0].translation).toBe("greeting");
  });

  it("handles ragged rows (missing columns)", () => {
    const { words, skipped } = parseDelimited("term-only\nfull\tmeaning\treading", {
      delimiter: "tab",
    });
    expect(skipped).toBe(0);
    expect(words).toEqual([
      { term: "term-only", translation: "", phonetic: null, meanings: null },
      { term: "full", translation: "meaning", phonetic: "reading", meanings: null },
    ]);
  });

  it("skips blank lines silently and rows without a term", () => {
    const { words, skipped } = parseDelimited("好\tgood\n\n\tno-term-here\n水\twater");
    expect(words.map((w) => w.term)).toEqual(["好", "水"]);
    // The truly-blank line is ignored; the "\tno-term-here" row counts as skipped.
    expect(skipped).toBe(1);
  });

  it("dedupes by term case-insensitively, counting dups as skipped", () => {
    const { words, skipped } = parseDelimited(
      "Hola\thello\nhola\thi again\nAdios\tbye"
    );
    expect(words.map((w) => w.term)).toEqual(["Hola", "Adios"]);
    expect(skipped).toBe(1);
  });

  it("respects a custom column role map", () => {
    // Columns: reading, term, ignore, translation
    const { words } = parseDelimited("nǐ hǎo\t你好\tXX\thello", {
      delimiter: "tab",
      columns: ["phonetic", "term", "ignore", "translation"],
    });
    expect(words).toEqual([
      { term: "你好", translation: "hello", phonetic: "nǐ hǎo", meanings: null },
    ]);
  });

  it("trims a trailing newline without emitting an empty row", () => {
    const { words } = parseDelimited("a\tb\n");
    expect(words).toHaveLength(1);
  });
});

describe("parseDelimited meanings column", () => {
  it("splits a meanings column on semicolons", () => {
    const { words } = parseDelimited("了\tle\t(completed action marker); to finish", {
      delimiter: "tab",
      columns: ["term", "phonetic", "meanings"],
    });
    expect(words).toEqual([
      {
        term: "了",
        translation: "(completed action marker); to finish",
        phonetic: "le",
        meanings: ["(completed action marker)", "to finish"],
      },
    ]);
  });

  it("keeps an explicit translation alongside meanings", () => {
    const { words } = parseDelimited("好\tgood\tgood; well; fine", {
      delimiter: "tab",
      columns: ["term", "translation", "meanings"],
    });
    expect(words[0].translation).toBe("good");
    expect(words[0].meanings).toEqual(["good", "well", "fine"]);
  });
});
