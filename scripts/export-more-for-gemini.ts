#!/usr/bin/env tsx
/**
 * Exports three more targeted datasets for external LLM cross-check,
 * following up on the vocabulary review (see export-for-gemini-review.ts):
 *
 *   1. hsknest-sentences-review.csv — stratified sample of 200 example
 *      sentences (25/HSK level), for translation-naturalness review.
 *      Structural issues (empty fields, duplicates, truncation) are
 *      already checked separately by check-sentence-quality.ts and came
 *      back clean, so this sample is purely for subjective judgment: does
 *      the English read naturally, or is it stilted/awkward Tatoeba-speak?
 *
 *   2. hsknest-german-review.csv — the FULL German vocabulary set (~310
 *      entries across a1/colors/family/food/freq100/greetings/numbers).
 *      Small enough to review in full rather than sample. Never had an
 *      automated quality pass like the Chinese HSK data did.
 *
 *   3. hsknest-zh-themed-review.csv — the FULL "original Chinese" themed
 *      starter lists (~76 entries: colors/family/food/greetings/numbers),
 *      separate from the HSK-graded decks. Same: never reviewed.
 *
 * Usage:
 *   npx tsx scripts/export-more-for-gemini.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const REPO = join(__dirname, "..");
const DATA_DIR = join(REPO, "prisma", "data");
const DESKTOP = join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");

function escapeCsv(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path: string, header: string[], rows: string[][]) {
  const out = [header.map(escapeCsv).join(",")];
  for (const r of rows) out.push(r.map(escapeCsv).join(","));
  writeFileSync(path, out.join("\n"), "utf-8");
  console.log(`✓ Wrote ${rows.length} rows to ${path}`);
}

function stride<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// --- 1. Sentences: stratified sample, 25/level -----------------------------
interface SeedSentence {
  text: string;
  translation: string;
  metadata: { level: number };
  phonetic?: string;
}
const sentences: SeedSentence[] = JSON.parse(
  readFileSync(join(DATA_DIR, "hsk", "sentences.json"), "utf-8")
);
const byLevel = new Map<number, SeedSentence[]>();
for (const s of sentences) {
  const lvl = s.metadata?.level ?? 0;
  if (!byLevel.has(lvl)) byLevel.set(lvl, []);
  byLevel.get(lvl)!.push(s);
}
const sentenceSample: SeedSentence[] = [];
for (const [, list] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
  sentenceSample.push(...stride(list, 25));
}
writeCsv(
  join(DESKTOP, "hsknest-sentences-review.csv"),
  ["text", "pinyin", "translation", "level"],
  sentenceSample.map((s) => [s.text, s.phonetic ?? "", s.translation, String(s.metadata?.level ?? 0)])
);
console.log(
  `Suggested prompt: "Review this Chinese sentence list (Chinese, pinyin, English translation, ` +
    `HSK level). Flag ONLY translations that are unnatural, stilted, grammatically odd in English, ` +
    `or that meaningfully misrepresent the Chinese. Ignore minor style differences. Return: ` +
    `text | issue | suggested fix."`
);

// --- 2. German vocabulary: full export --------------------------------------
interface GenericWord {
  term: string;
  translation: string;
  phonetic?: string;
  metadata?: { pos?: string };
}
const deFiles = globSync("*.json", { cwd: join(DATA_DIR, "de") });
const deWords: GenericWord[] = [];
for (const f of deFiles) {
  const data: GenericWord[] = JSON.parse(readFileSync(join(DATA_DIR, "de", f), "utf-8"));
  deWords.push(...data);
}
writeCsv(
  join(DESKTOP, "hsknest-german-review.csv"),
  ["term", "phonetic_ipa", "translation", "pos"],
  deWords.map((w) => [w.term, w.phonetic ?? "", w.translation, w.metadata?.pos ?? ""])
);
console.log(
  `Suggested prompt: "Review this German vocabulary list (term, IPA phonetic, English translation, ` +
    `part of speech). Flag entries with wrong/missing translations, wrong gender articles (der/die/das) ` +
    `if applicable, or incorrect IPA. Return: term | issue | suggested fix."`
);

// --- 3. Chinese themed starter lists: full export ---------------------------
const zhFiles = globSync("*.json", { cwd: join(DATA_DIR, "zh") });
const zhWords: GenericWord[] = [];
for (const f of zhFiles) {
  const data: GenericWord[] = JSON.parse(readFileSync(join(DATA_DIR, "zh", f), "utf-8"));
  zhWords.push(...data);
}
writeCsv(
  join(DESKTOP, "hsknest-zh-themed-review.csv"),
  ["term", "phonetic", "translation", "pos"],
  zhWords.map((w) => [w.term, w.phonetic ?? "", w.translation, w.metadata?.pos ?? ""])
);
console.log(
  `Suggested prompt: "Review this Chinese vocabulary list (term, pinyin, English translation, ` +
    `part of speech). Flag entries with wrong or misleading translations. Return: term | issue | ` +
    `suggested fix."`
);
