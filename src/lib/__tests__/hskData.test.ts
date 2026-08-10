/**
 * Regression guard for HSK data quality. Loads the merged (raw + curated)
 * vocabulary as it will appear in the database and checks for:
 * - Blank translations (definite bug)
 * - Classifier cruft (CL: notation — stripped by buildTranslation, but guard against reintroduction)
 * - Pinyin-code artifacts (…[Ha1 sa4…] — abbr leaks)
 *
 * Warnings (not failures) for remaining Han characters in translations — these
 * are often pedagogically useful (contrast/usage context), but we flag them for
 * manual review to catch new place-name regressions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Meaning = { gloss: string; reading?: string };
type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: {
    level: number;
    meanings?: Meaning[];
  } & Record<string, unknown>;
};

/**
 * Load raw + curated vocabulary the same way seed.ts does, to test
 * what users actually see.
 */
function loadMergedVocabulary(): SeedWord[] {
  const words: SeedWord[] = [];
  const curated: Record<string, Record<string, unknown>> = {};

  // Load curated overrides first
  for (let level = 1; level <= 7; level++) {
    try {
      const curatedPath = join(
        __dirname,
        "..",
        "..",
        "..",
        "prisma",
        "data",
        "hsk",
        "curated",
        `new${level}.json`
      );
      const curatedRaw = readFileSync(curatedPath, "utf-8");
      curated[level] = JSON.parse(curatedRaw);
    } catch {
      curated[level] = {};
    }
  }

  // Load raw vocabulary and apply overrides
  for (let level = 1; level <= 7; level++) {
    const rawPath = join(
      __dirname,
      "..",
      "..",
      "..",
      "prisma",
      "data",
      "hsk",
      `new${level}.json`
    );
    const rawData = JSON.parse(readFileSync(rawPath, "utf-8")) as SeedWord[];

    for (const w of rawData) {
      const override = curated[level]?.[w.term] as
        | { translation?: string; meanings?: unknown }
        | undefined;
      if (override) {
        const merged: SeedWord = {
          ...w,
          translation: override.translation ?? w.translation,
        };
        if (override.meanings && typeof w.metadata === "object" && w.metadata) {
          merged.metadata = {
            ...w.metadata,
            meanings: override.meanings as Meaning[] | undefined,
          };
        }
        words.push(merged);
      } else {
        words.push(w);
      }
    }
  }

  return words;
}

describe("HSK data regression guard", () => {
  const words = loadMergedVocabulary();

  it("finds no blank translations", () => {
    const blanks = words.filter((w) => !w.translation || w.translation.trim() === "");
    expect(blanks).toHaveLength(0);
    if (blanks.length > 0) {
      console.log("Blank translations:", blanks.map((w) => `${w.term}`).join(", "));
    }
  });

  it("finds no classifier cruft (CL: notation)", () => {
    const hasCL = words.filter((w) => /CL:/.test(w.translation));
    expect(hasCL).toHaveLength(0);
    if (hasCL.length > 0) {
      console.log(
        "Classifier cruft:",
        hasCL.map((w) => `${w.term}: ${w.translation.slice(0, 50)}`).join("; ")
      );
    }
  });

  it("logs any pinyin-code artifacts for manual review", () => {
    // Pinyin codes are only a problem when they're dominant (abbr-only),
    // not when they're illustrative (e.g., 生肖[sheng1 xiao4] in example phrases).
    // This is a soft warning, not a hard failure.
    const pinyinCodeRegex = /\[[A-Za-z]+\d[A-Za-z\d\s]*\]/;
    const hasPinyinCodes = words.filter((w) => pinyinCodeRegex.test(w.translation));

    if (hasPinyinCodes.length > 0) {
      console.warn(
        `\nPinyin-code artifacts (${hasPinyinCodes.length}): likely pedagogical (examples, alt pronunciations), but watch for abbr-only cases:`
      );
      hasPinyinCodes.slice(0, 5).forEach((w) => {
        console.warn(`  ${w.term}: "${w.translation.slice(0, 70)}"`);
      });
      if (hasPinyinCodes.length > 5) {
        console.warn(`  … and ${hasPinyinCodes.length - 5} more`);
      }
    }

    // Hard-fail only on pure abbreviation cruft (leading "abbr. for")
    const pureAbbrCruft = hasPinyinCodes.filter((w) => /^abbr\. for/.test(w.translation));
    expect(pureAbbrCruft).toHaveLength(0);
  });

  it("logs any remaining Han characters for manual review", () => {
    const HAN = /[一-鿿]/;
    const hasHan = words.filter((w) => HAN.test(w.translation));
    // Not a hard failure — Han characters can be pedagogically useful
    // (usage context, contrast references like "as opposed to 您").
    // This just makes future regressions visible.
    if (hasHan.length > 0) {
      console.warn(
        `\nRemaining Han-containing translations (${hasHan.length}): likely pedagogical (usage context, contrasts), but review for place-name regressions:`
      );
      hasHan.slice(0, 10).forEach((w) => {
        console.warn(`  ${w.term}: "${w.translation.slice(0, 60)}"`);
      });
      if (hasHan.length > 10) {
        console.warn(`  … and ${hasHan.length - 10} more`);
      }
    }
  });

  it("confirms merged vocabulary is non-empty", () => {
    expect(words.length).toBeGreaterThan(0);
    console.log(`Loaded ${words.length} merged vocabulary words`);
  });
});
