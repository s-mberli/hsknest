/**
 * One-off repair: normalize mixed-style pinyin in the vendored seed JSONs.
 *
 * The upstream complete-hsk-vocabulary dataset stores phonetics in several
 * styles (tone-marked "zhè", numbered "zhe4", colon "lu:4", capitalized
 * proper-noun forms). transformEntry now normalizes via normalizePinyin()
 * (see hskTransform.ts), but the already-vendored files carry the old mix —
 * 1187 of 11000 entries showed raw numbered pinyin on cards. This script
 * rewrites ONLY the pinyin strings in place:
 *   - word.phonetic
 *   - metadata.meanings[].reading (when present)
 *   - curated/*.json meanings[].reading (when present)
 *
 * Terms, translations, sense order and every other field are untouched, so
 * the diff is reviewable line-by-line. Idempotent: a second run changes 0.
 *
 *   npx tsx scripts/fix-phonetics.ts            (dry run)
 *   npx tsx scripts/fix-phonetics.ts --write
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizePinyin } from "../src/lib/hskTransform";
import { promoteCleanLead } from "../src/lib/glossGuard";

type Meaning = { gloss: string; reading?: string };
type SeedWord = {
  term: string;
  phonetic: string;
  metadata?: { meanings?: Meaning[] };
};

const FILES = [
  "new1", "new2", "new3", "new4", "new5", "new6", "new7", "freq100", "freq1000",
];

const write = process.argv.includes("--write");
let totalPhonetic = 0;
let totalReading = 0;

for (const file of FILES) {
  const path = join(__dirname, "..", "prisma", "data", "hsk", `${file}.json`);
  const data = JSON.parse(readFileSync(path, "utf8")) as SeedWord[];
  let filePhonetic = 0;
  let fileReading = 0;

  for (const w of data) {
    const fixed = normalizePinyin(w.phonetic);
    if (fixed !== w.phonetic) {
      w.phonetic = fixed;
      filePhonetic++;
    }
    const ms = w.metadata?.meanings ?? [];
    for (const m of ms) {
      if (m.reading) {
        const r = normalizePinyin(m.reading);
        if (r !== m.reading) {
          m.reading = r;
          fileReading++;
        }
      }
    }
    // While we're here: if a numbered-style proper-noun reading was masking
    // a clean lead (the 亚洲/Liège class), demote it under the same rules
    // fix-primary-glosses.ts applies to generated files.
    const { meanings, changed } = promoteCleanLead(ms, w.phonetic);
    if (changed) {
      w.metadata!.meanings = meanings;
      fileReading++; // counted with readings; logged separately below
    }
  }

  if ((filePhonetic || fileReading) && write) {
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  }
  console.log(
    `${file}: ${filePhonetic} phonetics, ${fileReading} readings/leads ${write ? "fixed" : "would change"}`
  );
  totalPhonetic += filePhonetic;
  totalReading += fileReading;
}

// Curated overrides may carry readings too (e.g. tagged multi-reading words).
let curReadings = 0;
for (const file of FILES.slice(0, 7)) {
  const path = join(__dirname, "..", "prisma", "data", "hsk", "curated", `${file}.json`);
  const curated = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    { translation?: string; meanings?: Meaning[] }
  >;
  let changed = false;
  for (const o of Object.values(curated)) {
    for (const m of o.meanings ?? []) {
      if (m.reading) {
        const r = normalizePinyin(m.reading);
        if (r !== m.reading) {
          m.reading = r;
          curReadings++;
          changed = true;
        }
      }
    }
  }
  if (changed && write) writeFileSync(path, JSON.stringify(curated, null, 2) + "\n");
}

console.log(
  `\n${write ? "WROTE" : "DRY RUN"} — ${totalPhonetic} phonetics + ${totalReading} readings/leads` +
    (curReadings ? ` + ${curReadings} curated readings` : "")
);
