/**
 * Verify Reading Mode stories against their target HSK level.
 *
 * The quality gate of the authoring loop: the LLM proposes, this script
 * verifies. Runs segmentation + vocabulary cross-tag + difficulty scoring on
 * each story file and prints a per-file report. PASS requires ≤5% of word
 * tokens above the target level; offenders are listed for human review.
 *
 * Usage:
 *   npx tsx scripts/verify-story.ts content/reading/hsk1/coffee-shop.md
 *   npx tsx scripts/verify-story.ts              # all stories
 *
 * Exit code 1 when any story is flagged (CI-able).
 */

import fs from "node:fs";
import path from "node:path";
import { gradeTokens } from "../src/lib/reading/grade";
import { loadCedict } from "../src/lib/reading/cedict";
import { loadHskLexicon } from "../src/lib/reading/lexicon";
import { segmentText } from "../src/lib/reading/segment";
import { parseStory, slugFor } from "./reading-md";

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function list(items: { lemma: string; count?: number; lvl?: number }[], n = 8): string {
  if (items.length === 0) return "  (none)";
  return items
    .slice(0, n)
    .map(
      (x) =>
        `  ${x.lemma}${x.lvl !== undefined ? ` [HSK${x.lvl}]` : ""}${
          x.count !== undefined ? ` ×${x.count}` : ""
        }`
    )
    .join("\n");
}

function main(): number {
  const args = process.argv.slice(2);
  const files =
    args.length > 0
      ? args
      : (() => {
          const dir = path.join(process.cwd(), "content", "reading");
          const out: string[] = [];
          const walk = (d: string) => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
              const p = path.join(d, e.name);
              if (e.isDirectory()) walk(p);
              else if (e.name.endsWith(".md")) out.push(p);
            }
          };
          walk(dir);
          return out;
        })();

  if (files.length === 0) {
    console.log("no story files found under content/reading/");
    return 1;
  }

  const lexicon = loadHskLexicon();
  const cedict = loadCedict();

  let flagged = 0;
  for (const file of files) {
    const story = parseStory(file);
    const slug = slugFor(story);
    const fm = story.frontmatter;
    const level = Number(fm.level);
    if (!Number.isInteger(level) || level < 1) {
      console.log(`${slug}: invalid frontmatter level "${fm.level}"`);
      flagged++;
      continue;
    }

    const { tokens } = segmentText(story.body, { lexicon, cedict });
    const r = gradeTokens(tokens, level);

    const head = `${slug} — HSK${level} "${(fm.title as string) ?? ""}" [${(fm.status as string) ?? "?"}]`;
    console.log(`\n${r.verdict === "pass" ? "PASS" : "FLAG"}  ${head}`);
    console.log(`  above-level: ${pct(r.aboveLevelPct)}  (limit 5.0%)`);
    console.log(`  at-level: ${r.atLevelUnique} distinct HSK${level} words`);
    console.log(`  length: ${r.chars} chars`);
    console.log(
      `  ~${r.estimatedMin} min read, sentences avg ${r.sentenceLength.avg}/max ${r.sentenceLength.max} chars`
    );
    if (r.reasons.length) {
      console.log(`  flag reasons:\n${r.reasons.map((x) => `    - ${x}`).join("\n")}`);
    }
    const bands = Object.entries(r.bandHistogram)
      .sort((a, b) => (a[0] === "off" ? 1 : b[0] === "off" ? -1 : Number(a[0]) - Number(b[0])))
      .map(([k, v]) => `${k === "off" ? "off-list" : `HSK${k}`}:${v}`)
      .join("  ");
    console.log(`  bands: ${bands}`);
    if (r.aboveLevel.length) {
      console.log(`  above-level lemmas:\n${list(r.aboveLevel)}`);
    }
    if (r.offList.length) {
      console.log(`  off-list lemmas (review: keep, simplify, or accept):\n${list(r.offList)}`);
    }
    if (r.lowRepetition.length) {
      console.log(`  at-level words repeated <3× (warning only):\n${list(r.lowRepetition)}`);
    }
    if (r.verdict === "flag") flagged++;
  }

  console.log(
    `\n${files.length} checked, ${flagged} flagged — ${flagged ? "fix offenders or lower the target level" : "ready for human review"}`
  );
  return flagged > 0 ? 1 : 0;
}

process.exitCode = main();
