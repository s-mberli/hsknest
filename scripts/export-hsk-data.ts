#!/usr/bin/env tsx
/**
 * Export all HSK vocabulary data to a flat CSV on the Desktop for external review.
 * Combines all prisma/data/hsk/*.json files into one CSV with columns:
 * term, translation, phonetic, pos, level
 *
 * Usage:
 *   npx tsx scripts/export-hsk-data.ts
 *
 * Output:
 *   ~/Desktop/hsknest-hsk-export.csv
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { globSync } from "glob";

const REPO = join(__dirname, "..");
const DATA_DIR = join(REPO, "prisma", "data", "hsk");
const DESKTOP = join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");
const OUTPUT = join(DESKTOP, "hsknest-hsk-export.csv");

interface HskWord {
  term: string;
  translation: string;
  phonetic?: string;
  metadata?: {
    level?: number;
    pos?: string | string[];
  };
}

function parseLevel(word: HskWord): number {
  return word.metadata?.level ?? 0;
}

function parsePos(word: HskWord): string {
  const pos = word.metadata?.pos;
  if (Array.isArray(pos)) {
    return pos.join(", ");
  }
  return typeof pos === "string" ? pos : "";
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const words: HskWord[] = [];
const seen = new Set<string>();

// Glob all JSON files in the HSK data directory
const files = globSync("*.json", { cwd: DATA_DIR });

console.log(`Processing ${files.length} file(s) in ${DATA_DIR}…`);

for (const file of files) {
  const path = join(DATA_DIR, file);
  try {
    const content = readFileSync(path, "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      for (const word of data) {
        // Dedupe by term to avoid duplicates across files
        if (word.term && !seen.has(word.term)) {
          seen.add(word.term);
          words.push(word);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading ${file}:`, error);
  }
}

console.log(`Found ${words.length} unique words.`);

// Sort by level, then alphabetically
words.sort((a, b) => {
  const levelDiff = parseLevel(a) - parseLevel(b);
  if (levelDiff !== 0) return levelDiff;
  return a.term.localeCompare(b.term);
});

// Build CSV
const rows: string[] = [
  ["term", "translation", "phonetic", "pos", "level"]
    .map(escapeCsv)
    .join(","),
];

for (const word of words) {
  const row = [
    escapeCsv(word.term),
    escapeCsv(word.translation || ""),
    escapeCsv(word.phonetic || ""),
    escapeCsv(parsePos(word)),
    String(parseLevel(word)),
  ].join(",");
  rows.push(row);
}

const csv = rows.join("\n");

try {
  writeFileSync(OUTPUT, csv, "utf-8");
  console.log(`✓ Exported ${words.length} words to ${OUTPUT}`);
  console.log(`File size: ${(csv.length / 1024).toFixed(1)} KB`);
} catch (error) {
  console.error(`Failed to write ${OUTPUT}:`, error);
  process.exit(1);
}
