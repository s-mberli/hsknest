#!/usr/bin/env tsx
/**
 * Detects the "故事 problem": a word's primary translation is archaic/rare
 * while its actual example sentences use it in a completely different,
 * more common sense — same failure mode found by manual review + Gemini
 * cross-check, now automated using our own sentence corpus as ground truth
 * instead of trusting an LLM's literal claims about "missing" senses.
 *
 * Heuristic: for each word with 2+ meanings AND linked example sentences,
 * check whether ANY content word from the primary translation appears in
 * ANY linked sentence's English translation. If zero overlap on the primary
 * sense but a LATER sense's words DO overlap, the primary sense is probably
 * misordered — flag it for manual reordering (see scripts/check-hsk-data-quality.ts
 * for the sibling structural-integrity scan).
 *
 * This is NOT a full-coverage checker — words with no linked sentences or a
 * single meaning are silently skipped (nothing to compare against). It is a
 * precision tool for the specific "wrong sense promoted" failure class.
 *
 * Usage:
 *   npx tsx scripts/check-primary-sense-order.ts
 *
 * Output:
 *   ~/Desktop/hsknest-sense-order-review.csv
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const REPO = join(__dirname, "..");
const DATA_DIR = join(REPO, "prisma", "data", "hsk");
const DESKTOP = join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");
const OUTPUT = join(DESKTOP, "hsknest-sense-order-review.csv");

const STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "for", "and", "or", "is",
  "are", "was", "were", "be", "been", "being", "this", "that", "these",
  "those", "it", "its", "as", "by", "with", "from", "used", "sth", "sb",
  "etc", "also", "pr", "esp", "fig", "abbr", "cl",
]);

function contentWords(gloss: string): Set<string> {
  return new Set(
    gloss
      .toLowerCase()
      .replace(/[()[\]{}.,;:!?"']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

interface HskMeaning {
  gloss: string;
}
interface HskWord {
  term: string;
  translation: string;
  phonetic?: string;
  metadata?: { level?: number; meanings?: HskMeaning[] };
}
interface SeedSentence {
  text: string;
  translation: string;
  terms: string[];
}

const wordFiles = globSync("*.json", { cwd: DATA_DIR }).filter((f) => f !== "sentences.json");
const words: HskWord[] = [];
const seen = new Set<string>();
for (const file of wordFiles) {
  const data: HskWord[] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
  for (const w of data) {
    if (w.term && !seen.has(w.term)) {
      seen.add(w.term);
      words.push(w);
    }
  }
}

const sentences: SeedSentence[] = JSON.parse(
  readFileSync(join(DATA_DIR, "sentences.json"), "utf-8")
);
const sentencesByTerm = new Map<string, SeedSentence[]>();
for (const s of sentences) {
  for (const t of s.terms) {
    if (!sentencesByTerm.has(t)) sentencesByTerm.set(t, []);
    sentencesByTerm.get(t)!.push(s);
  }
}

console.log(`Checking ${words.length} words against ${sentences.length} sentences…`);

interface Flag {
  term: string;
  phonetic: string;
  primaryTranslation: string;
  betterSenseIndex: number;
  betterSenseGloss: string;
  exampleSentence: string;
  exampleTranslation: string;
}

const flags: Flag[] = [];
let checked = 0;

for (const w of words) {
  const meanings = w.metadata?.meanings ?? [];
  if (meanings.length < 2) continue;
  const linked = sentencesByTerm.get(w.term);
  if (!linked || linked.length === 0) continue;
  checked++;

  const primaryWords = contentWords(w.translation ?? meanings[0]?.gloss ?? "");
  if (primaryWords.size === 0) continue;

  // Does any linked sentence translation share vocabulary with the primary sense?
  const primaryMatches = linked.some((s) => {
    const sentWords = contentWords(s.translation);
    return [...primaryWords].some((pw) => sentWords.has(pw));
  });
  if (primaryMatches) continue; // primary sense is corroborated by usage — fine.

  // Primary sense has zero corroboration. Does a LATER sense match instead?
  for (let i = 1; i < meanings.length; i++) {
    const laterWords = contentWords(meanings[i].gloss);
    if (laterWords.size === 0) continue;
    const match = linked.find((s) => {
      const sentWords = contentWords(s.translation);
      return [...laterWords].some((lw) => sentWords.has(lw));
    });
    if (match) {
      flags.push({
        term: w.term,
        phonetic: w.phonetic ?? "",
        primaryTranslation: w.translation ?? "",
        betterSenseIndex: i,
        betterSenseGloss: meanings[i].gloss,
        exampleSentence: match.text,
        exampleTranslation: match.translation,
      });
      break; // one flag per word is enough to prompt a manual look.
    }
  }
}

console.log(`Checked ${checked} multi-sense words with linked examples.`);
console.log(`Flagged ${flags.length} words where the primary sense has zero corroboration`);
console.log(`from its own example sentences, but a later sense (index >=1) matches.`);

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

const rows = [
  ["term", "phonetic", "primary_translation", "better_sense_index", "better_sense_gloss", "example_zh", "example_en"]
    .map(escapeCsv)
    .join(","),
];
for (const f of flags) {
  rows.push(
    [
      f.term,
      f.phonetic,
      f.primaryTranslation,
      String(f.betterSenseIndex),
      f.betterSenseGloss,
      f.exampleSentence,
      f.exampleTranslation,
    ]
      .map(escapeCsv)
      .join(",")
  );
}
writeFileSync(OUTPUT, rows.join("\n"), "utf-8");
console.log(`\n✓ Wrote ${flags.length} rows to ${OUTPUT}`);
console.log(`Note: this is a precision heuristic, not proof — a flagged word may legitimately`);
console.log(`have its primary sense correct even if that specific example sentence uses another.`);
console.log(`Manually confirm each row before reordering.`);
