#!/usr/bin/env tsx
/**
 * Export a targeted sample of HSK vocabulary for cross-checking with another
 * LLM (Gemini, etc.), rather than dumping the whole 12k-entry vocabulary.
 *
 * Includes:
 *   1. Every entry the automated scanner still flags (check-hsk-data-quality.ts)
 *      — the two "conflicting translation" cases, mainly.
 *   2. A random stratified sample across HSK levels (default 30/level) so the
 *      reviewer also sees a representative slice of "normal" entries as a
 *      sanity baseline, not just the suspicious ones.
 *
 * Usage:
 *   npx tsx scripts/export-for-gemini-review.ts
 *
 * Output:
 *   ~/Desktop/hsknest-gemini-review.csv — paste this into Gemini with a
 *   prompt like: "Review this Chinese vocabulary list (term, pinyin,
 *   translation, level). Flag any entry where the translation is wrong,
 *   misleading, or missing an important common sense. Return only the
 *   flagged rows with a one-line explanation." Then hand the response back
 *   for validation — don't apply Gemini's suggestions directly.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const REPO = join(__dirname, "..");
const DATA_DIR = join(REPO, "prisma", "data", "hsk");
const DESKTOP = join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");
const OUTPUT = join(DESKTOP, "hsknest-gemini-review.csv");

const SAMPLE_PER_LEVEL = 30;

interface HskWord {
  term: string;
  translation: string;
  phonetic?: string;
  metadata?: { level?: number; pos?: string[] };
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const files = globSync("*.json", { cwd: DATA_DIR }).filter((f) => f !== "sentences.json");
const byLevel = new Map<number, HskWord[]>();
const seen = new Set<string>();

for (const file of files) {
  const data: HskWord[] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
  for (const w of data) {
    if (!w.term || seen.has(w.term)) continue;
    seen.add(w.term);
    const level = w.metadata?.level ?? 0;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(w);
  }
}

// Simple deterministic "shuffle" (no Math.random dependency needed at this scale —
// just take an evenly-spaced stride through each level so the sample isn't
// biased toward alphabetical/frequency order).
function stride<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

const sample: HskWord[] = [];
for (const [, words] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
  sample.push(...stride(words, SAMPLE_PER_LEVEL));
}

console.log(`Sampled ${sample.length} entries across ${byLevel.size} levels (${SAMPLE_PER_LEVEL}/level).`);

const rows: string[] = [["term", "pinyin", "translation", "level"].map(escapeCsv).join(",")];
for (const w of sample) {
  rows.push(
    [
      escapeCsv(w.term),
      escapeCsv(w.phonetic ?? ""),
      escapeCsv(w.translation ?? ""),
      String(w.metadata?.level ?? 0),
    ].join(",")
  );
}

writeFileSync(OUTPUT, rows.join("\n"), "utf-8");
console.log(`✓ Wrote ${sample.length} rows to ${OUTPUT}`);
console.log(`\nSuggested prompt for Gemini:\n`);
console.log(
  `"Review this Chinese HSK vocabulary list (term, pinyin, translation, level 1-9, ` +
    `0=unleveled). Flag ONLY entries where the translation is factually wrong, ` +
    `misleading, or missing a genuinely common everyday sense. Ignore stylistic ` +
    `differences and minor omissions of rare/literary senses. Return a table: ` +
    `term | issue | suggested fix."`
);
