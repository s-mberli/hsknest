/**
 * HSK 3.0 vocabulary lexicon for Reading Mode grading and hydration.
 *
 * Built from the repo's own seed data (`prisma/data/hsk/new{1..7}.json`),
 * which is the single source of truth the study deck itself uses — no
 * external CSV. Levels 8-9 of HSK 3.0 fold into 7 (the files ship one band
 * for 7-9), matching the deck's own convention.
 *
 * Node-only: loaded by offline scripts (verify/ingest) and server code.
 * Weighs a few MB in memory; never imported client-side.
 */

import fs from "node:fs";
import path from "node:path";

export type HskLexicon = Map<string, number>;

let cache: HskLexicon | null = null;

interface SeedWord {
  term: string;
  metadata?: { level?: number };
}

/**
 * Load term → level map. If a term appears in several bands (some function
 * words are listed twice), the lowest band wins — the more useful answer to
 * "is this word available to a level-N learner?".
 */
export function loadHskLexicon(dataDir?: string): HskLexicon {
  if (cache && !dataDir) return cache;
  const dir =
    dataDir ?? path.join(process.cwd(), "prisma", "data", "hsk");
  const lex: HskLexicon = new Map();
  for (let lvl = 1; lvl <= 7; lvl++) {
    const file = path.join(dir, `new${lvl}.json`);
    if (!fs.existsSync(file)) continue;
    const rows: SeedWord[] = JSON.parse(fs.readFileSync(file, "utf-8"));
    for (const row of rows) {
      const term = (row.term ?? "").trim();
      const level = row.metadata?.level ?? lvl;
      if (!term) continue;
      const prev = lex.get(term);
      if (prev === undefined || level < prev) lex.set(term, level);
    }
  }
  if (!dataDir) cache = lex;
  return lex;
}
