/**
 * Compile curated HSK glosses from journal + rule-based fallback.
 *
 * Reads:
 *   - journal.jsonl (Claude Desktop workflow output)
 *   - curation_input_L*.json (scratchpad input files)
 *
 * Writes:
 *   - prisma/data/hsk/curated/new{1..7}.json (curated override files)
 *
 * Usage:
 *   npx tsx scripts/compile-curated-glosses.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Paths ──────────────────────────────────────────────────────────
const JOURNAL_PATH =
  "C:\\Users\\mrks\\.claude\\projects\\C--Users-mrks-Documents-claude-project\\764bd506-3f71-4deb-b4d4-b98170bc2066\\subagents\\workflows\\wf_cc7a22a6-021\\journal.jsonl";

const SCRATCHPAD_DIR =
  "C:\\Users\\mrks\\AppData\\Local\\Temp\\claude\\C--Users-mrks-Documents-claude-project\\764bd506-3f71-4deb-b4d4-b98170bc2066\\scratchpad";

const OUTPUT_DIR = join(__dirname, "..", "prisma", "data", "hsk", "curated");

// ── Types ──────────────────────────────────────────────────────────
type ScratchpadEntry = {
  term: string;
  phonetic: string;
  level: number;
  rawSenseCount: number;
  cleanSenses: string[];
  refGloss: string | null;
  agreement: "agrees" | "disagrees" | "no-ref";
};

type CuratedOverride = {
  translation: string;
  meanings: { gloss: string }[];
};

// ── 1. Parse journal ───────────────────────────────────────────────
function parseJournal(path: string): Map<string, string[]> {
  const curated = new Map<string, string[]>();
  const raw = readFileSync(path, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed);
      if (entry.type === "result" && entry.result?.results) {
        for (const w of entry.result.results) {
          if (w.term && Array.isArray(w.after)) {
            curated.set(w.term, w.after);
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }
  return curated;
}

// ── 2. Rule-based curation for remaining words ─────────────────────
function ruleBasedCurate(entry: ScratchpadEntry): string[] {
  const { cleanSenses, agreement, refGloss } = entry;

  if (cleanSenses.length <= 3) return cleanSenses;

  // For "disagrees" cases, try to promote the sense that matches refGloss
  if (agreement === "disagrees" && refGloss) {
    const refWords = refGloss
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    if (refWords.length > 0) {
      let bestIdx = 0;
      let bestScore = 0;
      for (let i = 0; i < cleanSenses.length; i++) {
        const sense = cleanSenses[i].toLowerCase();
        const score = refWords.filter((w) => sense.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestScore > 0 && bestIdx !== 0) {
        const result = [cleanSenses[bestIdx]];
        // Add first sense as second if distinct
        if (cleanSenses[0] !== cleanSenses[bestIdx]) {
          result.push(cleanSenses[0]);
        }
        // Fill up to 3 with remaining distinct senses
        for (let i = 1; i < cleanSenses.length && result.length < 3; i++) {
          if (i !== bestIdx && !result.includes(cleanSenses[i])) {
            result.push(cleanSenses[i]);
          }
        }
        return result;
      }
    }
  }

  return cleanSenses.slice(0, 3);
}

// ── 3. Main ────────────────────────────────────────────────────────
function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const journalMap = parseJournal(JOURNAL_PATH);
  console.log(`Journal: ${journalMap.size} unique terms with curated results`);

  const LEVEL_MAP: Record<string, string> = {
    L1: "new1",
    L2: "new2",
    L3: "new3",
    L4: "new4",
    L5: "new5",
    L6: "new6",
    L7: "new7",
  };

  let totalWords = 0;
  let totalJournal = 0;
  let totalRule = 0;

  for (const [level, outFile] of Object.entries(LEVEL_MAP)) {
    const scratchPath = join(SCRATCHPAD_DIR, `curation_input_${level}.json`);
    const entries: ScratchpadEntry[] = JSON.parse(
      readFileSync(scratchPath, "utf-8")
    );

    const overrides: Record<string, CuratedOverride> = {};
    let journalHits = 0;
    let ruleHits = 0;

    for (const entry of entries) {
      const curatedSenses = journalMap.get(entry.term);
      let after: string[];

      if (curatedSenses) {
        after = curatedSenses;
        journalHits++;
      } else {
        after = ruleBasedCurate(entry);
        ruleHits++;
      }

      overrides[entry.term] = {
        translation: after.join("; "),
        meanings: after.map((g) => ({ gloss: g })),
      };
    }

    const outPath = join(OUTPUT_DIR, `${outFile}.json`);
    writeFileSync(outPath, JSON.stringify(overrides, null, 2) + "\n", "utf-8");

    console.log(
      `${outFile}.json: ${entries.length} words (journal=${journalHits} rule=${ruleHits})`
    );
    totalWords += entries.length;
    totalJournal += journalHits;
    totalRule += ruleHits;
  }

  console.log(
    `\nDone — ${totalWords} words written to curated/ (${totalJournal} from journal, ${totalRule} rule-based)`
  );
}

main();
