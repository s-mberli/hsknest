/**
 * Migrate HSK word lists from the 2021 GF0025-2021 draft framework to the
 * November 2025 official syllabus (新版HSK考试大纲).
 *
 * Uses hanzistroke.com PDF text extracts as the level mapping reference.
 * Only takes term → level from the PDFs; all English content stays from
 * CC-CEDICT (CC BY-SA 4.0).
 *
 * Usage:
 *   npx tsx scripts/migrate-hsk-levels.ts
 *
 * Reads:
 *   - Hanzistroke text files from scratchpad (paths hardcoded below)
 *   - prisma/data/hsk/new1-7.json (current word data)
 *   - prisma/data/hsk/curated/new1-7.json (curated overrides)
 *
 * Writes:
 *   - prisma/data/hsk/new1-7.json (reassigned by level)
 *   - prisma/data/hsk/curated/new1-7.json (remapped overrides)
 *   - migration-gaps.txt (terms in official list but not in our data)
 *   - migration-extras.txt (terms in our data but not in official list)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SCRATCHPAD = String.raw`C:\Users\mrks\AppData\Local\Temp\claude\C--Users-mrks-Documents-claude-project\764bd506-3f71-4deb-b4d4-b98170bc2066\scratchpad`;
const DATA_DIR = join(__dirname, "..", "prisma", "data", "hsk");
const CURATED_DIR = join(DATA_DIR, "curated");

const HANZISTROKE_FILES: { file: string; level: number }[] = [
  { file: "hsk1.txt", level: 1 },
  { file: "HSK2.txt", level: 2 },
  { file: "HSK3.txt", level: 3 },
  { file: "HSK4.txt", level: 4 },
  { file: "HSK5.txt", level: 5 },
  { file: "HSK6.txt", level: 6 },
  { file: "HSK7-9.txt", level: 7 },
];

const EXPECTED_COUNTS: Record<number, number> = {
  1: 300, 2: 200, 3: 500, 4: 1000, 5: 1600, 6: 1800, 7: 5600,
};

// CJK Unified Ideographs range — detect lines starting with Chinese characters
const CJK_RE = /^([一-鿿㐀-䶿豈-﫿]+(?:[|·‧][一-鿿㐀-䶿豈-﫿]+)*)\s/;

// ---------------------------------------------------------------------------
// Step 1: Parse hanzistroke text files → term → level mapping
// ---------------------------------------------------------------------------
function parseHanzistrokes(): Map<string, number> {
  const mapping = new Map<string, number>();

  for (const { file, level } of HANZISTROKE_FILES) {
    const path = join(SCRATCHPAD, file);
    const text = readFileSync(path, "utf-8");
    const lines = text.split("\n");
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("also:") || trimmed.startsWith("HSK") ||
          trimmed.startsWith("Word") || trimmed.startsWith("hanzistroke") ||
          trimmed.startsWith("·")) continue;

      const match = trimmed.match(CJK_RE);
      if (!match) continue;

      // Handle multi-variant terms like "爸爸|爸" — take each variant
      const rawTerm = match[1];
      const variants = rawTerm.split(/[|·‧]/);
      for (const v of variants) {
        if (v && !mapping.has(v)) {
          mapping.set(v, level);
        }
      }
      count++;
    }

    console.log(`Level ${level}: parsed ${count} lines (expected ${EXPECTED_COUNTS[level]})`);
  }

  console.log(`\nTotal unique terms in mapping: ${mapping.size}`);
  return mapping;
}

// ---------------------------------------------------------------------------
// Step 2: Pool current word data
// ---------------------------------------------------------------------------
type WordEntry = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: Record<string, unknown>;
};

function loadCurrentWords(): Map<string, WordEntry> {
  const pool = new Map<string, WordEntry>();
  for (let level = 1; level <= 7; level++) {
    const path = join(DATA_DIR, `new${level}.json`);
    const words: WordEntry[] = JSON.parse(readFileSync(path, "utf-8"));
    for (const w of words) {
      if (!pool.has(w.term)) {
        pool.set(w.term, w);
      }
    }
  }
  console.log(`\nCurrent word pool: ${pool.size} unique terms`);
  return pool;
}

// ---------------------------------------------------------------------------
// Step 3: Pool curated overrides
// ---------------------------------------------------------------------------
type CuratedOverride = { translation?: string; meanings?: unknown };

function loadCuratedOverrides(): Map<string, CuratedOverride> {
  const pool = new Map<string, CuratedOverride>();
  for (let level = 1; level <= 7; level++) {
    const path = join(CURATED_DIR, `new${level}.json`);
    if (!existsSync(path)) continue;
    const data: Record<string, CuratedOverride> = JSON.parse(readFileSync(path, "utf-8"));
    for (const [term, override] of Object.entries(data)) {
      if (!pool.has(term)) {
        pool.set(term, override);
      }
    }
  }
  console.log(`Curated overrides pool: ${pool.size} terms`);
  return pool;
}

// ---------------------------------------------------------------------------
// Step 4: Reassign and write
// ---------------------------------------------------------------------------
function migrate() {
  const officialMapping = parseHanzistrokes();
  const wordPool = loadCurrentWords();
  const curatedPool = loadCuratedOverrides();

  // Buckets for new files
  const newWords: Map<number, WordEntry[]> = new Map();
  const newCurated: Map<number, Record<string, CuratedOverride>> = new Map();
  for (let l = 1; l <= 7; l++) {
    newWords.set(l, []);
    newCurated.set(l, {});
  }

  const gaps: string[] = [];
  const matched = new Set<string>();

  // Assign words based on official mapping
  for (const [term, level] of officialMapping) {
    const word = wordPool.get(term);
    if (word) {
      // Update the level in metadata
      const updated = {
        ...word,
        metadata: { ...(word.metadata || {}), level },
      };
      newWords.get(level)!.push(updated);
      matched.add(term);

      // Move curated override to correct level
      const override = curatedPool.get(term);
      if (override) {
        newCurated.get(level)![term] = override;
      }
    } else {
      gaps.push(`${term}\t${level}`);
    }
  }

  // Find extras (in our data but not in official list)
  const extras: string[] = [];
  for (const [term] of wordPool) {
    if (!matched.has(term)) {
      extras.push(term);
    }
  }

  // Write new data files
  console.log("\n=== Output ===\n");
  for (let level = 1; level <= 7; level++) {
    const words = newWords.get(level)!;
    const expected = EXPECTED_COUNTS[level];
    const status = words.length === expected ? "✓" : `⚠ expected ${expected}`;
    console.log(`new${level}.json: ${words.length} words ${status}`);

    writeFileSync(
      join(DATA_DIR, `new${level}.json`),
      JSON.stringify(words),
      "utf-8"
    );

    const curated = newCurated.get(level)!;
    const curatedCount = Object.keys(curated).length;
    writeFileSync(
      join(CURATED_DIR, `new${level}.json`),
      JSON.stringify(curated),
      "utf-8"
    );
    console.log(`  curated/new${level}.json: ${curatedCount} overrides`);
  }

  // Write gap and extras reports
  if (gaps.length > 0) {
    writeFileSync(join(__dirname, "..", "migration-gaps.txt"), gaps.join("\n"), "utf-8");
    console.log(`\n⚠ ${gaps.length} terms in official list but NOT in our data → migration-gaps.txt`);
  } else {
    console.log("\n✓ No gaps — all official terms found in our data");
  }

  if (extras.length > 0) {
    writeFileSync(join(__dirname, "..", "migration-extras.txt"), extras.join("\n"), "utf-8");
    console.log(`${extras.length} terms in our data but NOT in official list → migration-extras.txt`);
  }

  // Summary
  const totalOut = Array.from(newWords.values()).reduce((s, w) => s + w.length, 0);
  console.log(`\nTotal words written: ${totalOut}`);
  console.log(`Total curated overrides remapped: ${Array.from(newCurated.values()).reduce((s, c) => s + Object.keys(c).length, 0)}`);
}

migrate();
