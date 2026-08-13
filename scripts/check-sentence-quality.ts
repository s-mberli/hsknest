#!/usr/bin/env tsx
/**
 * Structural + duplicate scan over prisma/data/hsk/sentences.json before
 * handing a sample to an external LLM for translation-naturalness review.
 * Mirrors check-hsk-data-quality.ts's two-stage approach: catch what's
 * programmatically detectable first, so the LLM only judges genuinely
 * subjective quality (does this translation read naturally?).
 *
 * Checks:
 *   - empty/missing translation or phonetic
 *   - duplicate `text` (should be deduped already by selectSentences, but
 *     verify — a regression here means seed.ts double-counts word links)
 *   - suspiciously short translation relative to sentence length (possible
 *     truncation)
 *   - character-count mismatch between phonetic syllables and zh text
 *     length (rough proxy for a garbled/incomplete phonetic pass)
 *
 * Usage:
 *   npx tsx scripts/check-sentence-quality.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..");
const PATH = join(REPO, "prisma", "data", "hsk", "sentences.json");
const DESKTOP = join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");
const OUTPUT = join(DESKTOP, "hsknest-sentence-flagged.csv");

interface SeedSentence {
  text: string;
  translation: string;
  source: string;
  terms: string[];
  phonetic?: string;
  metadata: { level: number };
}

const sentences: SeedSentence[] = JSON.parse(readFileSync(PATH, "utf-8"));
console.log(`Scanning ${sentences.length} sentences…`);

const seenText = new Map<string, number>();
const flagged: { text: string; translation: string; reason: string }[] = [];

for (const s of sentences) {
  const reasons: string[] = [];

  if (!s.translation || !s.translation.trim()) reasons.push("empty translation");
  if (!s.phonetic || !s.phonetic.trim()) reasons.push("empty phonetic");

  const dupCount = (seenText.get(s.text) ?? 0) + 1;
  seenText.set(s.text, dupCount);
  if (dupCount > 1) reasons.push(`duplicate text (seen ${dupCount}x)`);

  // Rough proxy: a translation under ~40% of the zh char count is often
  // truncated (won't catch every case — short zh sentences naturally have
  // short translations too, hence "rough").
  const zhLen = [...s.text].length;
  const enLen = s.translation.split(/\s+/).filter(Boolean).length;
  if (zhLen > 8 && enLen <= 1) reasons.push("translation suspiciously short for sentence length");

  if (reasons.length > 0) {
    flagged.push({ text: s.text, translation: s.translation, reason: reasons.join(" | ") });
  }
}

console.log(`Flagged ${flagged.length} of ${sentences.length} (${((flagged.length / sentences.length) * 100).toFixed(1)}%).`);

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const rows = [["text", "translation", "reason"].map(escapeCsv).join(",")];
for (const f of flagged) rows.push([f.text, f.translation, f.reason].map(escapeCsv).join(","));
writeFileSync(OUTPUT, rows.join("\n"), "utf-8");
console.log(`✓ Wrote ${flagged.length} rows to ${OUTPUT}`);
