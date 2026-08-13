#!/usr/bin/env tsx
/**
 * Automated consistency scan over the vendored HSK vocabulary
 * (prisma/data/hsk/*.json) — flags entries worth a second look, so a
 * human or another model reviews a few hundred suspicious rows instead
 * of ~20,000 fine ones. Read-only; touches nothing.
 *
 * Checks:
 *   - duplicate term across files with a CONFLICTING translation
 *     (same term, same translation across files = expected overlap, not flagged)
 *   - missing/empty translation
 *   - suspiciously short translation (<=1 char, likely truncated)
 *   - unmapped POS code (not in CardFace.tsx's POS_LABELS — keep in sync manually)
 *   - phonetic field present but contains no tone marks/tone-number
 *     (heuristic: no diacritic and no digit 1-5 — likely missing pinyin)
 *   - term appears with an empty meanings array despite having a translation
 *
 * Usage:
 *   npx tsx scripts/check-hsk-data-quality.ts
 *
 * Output:
 *   ~/Desktop/hsknest-flagged-for-review.csv — only the flagged subset,
 *   with a `reason` column, ready to hand to another model or read by eye.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const REPO = join(__dirname, "..");
const DATA_DIR = join(REPO, "prisma", "data", "hsk");
const DESKTOP = join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");
const OUTPUT = join(DESKTOP, "hsknest-flagged-for-review.csv");

// Kept in sync with src/components/study/CardFace.tsx's POS_LABELS.
const KNOWN_POS_CODES = new Set([
  "n", "v", "a", "d", "r", "p", "c", "cc", "m", "mq", "q", "qt", "qv", "u", "y",
  "ad", "an", "vn", "nr", "ns", "nt", "nz", "b", "e", "f", "h", "k", "l", "o",
  "s", "t", "z", "tg", "Mg", "Rg", "g", "phrase",
]);

// A rough tone-mark / tone-number check for pinyin phonetics.
const HAS_TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńň]/i;
const HAS_TONE_NUMBER = /[1-5]/;

interface HskMeaning {
  gloss: string;
  reading?: string;
}

interface HskWord {
  term: string;
  translation: string;
  phonetic?: string;
  metadata?: {
    level?: number;
    pos?: string[];
    meanings?: HskMeaning[];
  };
}

interface FlaggedRow {
  term: string;
  translation: string;
  phonetic: string;
  pos: string;
  level: number;
  file: string;
  reason: string;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const files = globSync("*.json", { cwd: DATA_DIR }).filter((f) => f !== "sentences.json");
console.log(`Scanning ${files.length} word file(s)…`);

const flagged: FlaggedRow[] = [];
const termFirstSeen = new Map<string, { translation: string; file: string }>();
let totalWords = 0;

for (const file of files) {
  const path = join(DATA_DIR, file);
  let data: HskWord[];
  try {
    data = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    console.error(`Could not parse ${file}:`, error);
    continue;
  }
  if (!Array.isArray(data)) continue;

  for (const word of data) {
    totalWords++;
    const reasons: string[] = [];
    const term = (word.term || "").trim();
    const translation = (word.translation || "").trim();
    const phonetic = (word.phonetic || "").trim();
    const pos = word.metadata?.pos ?? [];
    const level = word.metadata?.level ?? 0;
    const meanings = word.metadata?.meanings ?? [];

    if (!term) {
      reasons.push("empty term");
    }

    if (!translation) {
      reasons.push("empty translation");
    } else if (translation.length <= 1) {
      reasons.push("suspiciously short translation");
    }

    // Duplicate term with a conflicting translation across files.
    if (term) {
      const prior = termFirstSeen.get(term);
      if (prior && prior.translation !== translation) {
        reasons.push(
          `conflicting translation vs ${prior.file} ("${prior.translation.slice(0, 40)}")`
        );
      } else if (!prior) {
        termFirstSeen.set(term, { translation, file });
      }
    }

    // Unmapped POS codes.
    const unmappedPos = pos.filter((code) => !KNOWN_POS_CODES.has(code));
    if (unmappedPos.length > 0) {
      reasons.push(`unmapped POS code(s): ${unmappedPos.join(", ")}`);
    }

    // Phonetic present but no tone info at all.
    if (phonetic && !HAS_TONE_MARK.test(phonetic) && !HAS_TONE_NUMBER.test(phonetic)) {
      // Skip pure-latin/punctuation entries (e.g. "%", "AA") where pinyin doesn't apply.
      const looksLikeChinese = /[㐀-鿿豈-﫿]/.test(term);
      if (looksLikeChinese) {
        reasons.push("phonetic has no tone marks or tone numbers");
      }
    }

    // Has a translation but an explicitly empty meanings array (when the field exists).
    if (translation && word.metadata && "meanings" in word.metadata && meanings.length === 0) {
      reasons.push("empty meanings array despite having a translation");
    }

    if (reasons.length > 0) {
      flagged.push({
        term,
        translation,
        phonetic,
        pos: pos.join(", "),
        level,
        file,
        reason: reasons.join(" | "),
      });
    }
  }
}

console.log(`Scanned ${totalWords} total word entries.`);
console.log(`Flagged ${flagged.length} entries (${((flagged.length / totalWords) * 100).toFixed(1)}%) for review.`);

// Summarize reason categories.
const reasonCounts = new Map<string, number>();
for (const row of flagged) {
  for (const r of row.reason.split(" | ")) {
    // Bucket the "conflicting translation" and "unmapped POS" variants together.
    const bucket = r.startsWith("conflicting translation")
      ? "conflicting translation"
      : r.startsWith("unmapped POS code")
        ? "unmapped POS code"
        : r;
    reasonCounts.set(bucket, (reasonCounts.get(bucket) ?? 0) + 1);
  }
}
console.log("\nBreakdown:");
for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(5)}  ${reason}`);
}

const rows: string[] = [
  ["term", "translation", "phonetic", "pos", "level", "file", "reason"].map(escapeCsv).join(","),
];
for (const row of flagged) {
  rows.push(
    [
      escapeCsv(row.term),
      escapeCsv(row.translation),
      escapeCsv(row.phonetic),
      escapeCsv(row.pos),
      String(row.level),
      escapeCsv(row.file),
      escapeCsv(row.reason),
    ].join(",")
  );
}

writeFileSync(OUTPUT, rows.join("\n"), "utf-8");
console.log(`\n✓ Wrote ${flagged.length} flagged rows to ${OUTPUT}`);
