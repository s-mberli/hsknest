import path from "node:path";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStory } from "../../../../scripts/reading-md";

/**
 * Regression guard for the specific way `sentencesEn` breaks silently.
 *
 * src/lib/reading/hydrate.ts assigns `frontmatter.sentencesEn[i]` to the i-th
 * blank-line-separated paragraph, bounded by
 * `pi < paragraphs.length && pi < sentenceEn.length` — so a paragraph
 * inserted, deleted, split, or merged without updating `sentencesEn` in
 * lockstep does not throw or log anything. Every later translation is either
 * silently shifted onto the wrong paragraph, or silently missing. This test
 * is the only thing standing between an editor and that failure mode: it
 * asserts every real story file's paragraph count matches its `sentencesEn`
 * entry count, so a mismatch fails CI instead of shipping unnoticed.
 */

const STORY_FILES = globSync("content/reading/**/*.md", {
  cwd: path.join(process.cwd()),
}).map((f) => path.join(process.cwd(), f));

describe("story content <-> sentencesEn alignment", () => {
  it("found story files to check (guards against an empty glob passing vacuously)", () => {
    expect(STORY_FILES.length).toBeGreaterThan(0);
  });

  it.each(STORY_FILES)("%s: paragraph count matches sentencesEn length", (file) => {
    const story = parseStory(file);
    const paragraphs = story.body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const sentencesEn = story.frontmatter.sentencesEn;
    expect(Array.isArray(sentencesEn)).toBe(true);
    expect(paragraphs.length).toBe((sentencesEn as string[]).length);
  });
});
