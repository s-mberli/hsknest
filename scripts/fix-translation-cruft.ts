/**
 * Strip CC-CEDICT cruft (classifier notes, abbreviation pointers, variant markers,
 * trailing place-name appositives) from translation strings in the merged HSK data.
 * This fixes ~60 words where the translation contains dictionary metadata that
 * shouldn't be shown to learners (e.g., "Europe (abbr. for…)" → "Europe").
 *
 * After stripping, reports any words that still contain Han characters — those
 * are candidates for manual curation overrides (e.g., 8 blanks, ~12 place-names
 * that were geography-dominant).
 *
 *   npx tsx scripts/fix-translation-cruft.ts --write   (omit --write for dry run)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: Record<string, unknown>;
};

const FILES = [
  "new1", "new2", "new3", "new4", "new5", "new6", "new7", "freq100", "freq1000",
];

/**
 * Strip CC-CEDICT cruft from a translation. Mirrors the logic in
 * src/lib/hskTransform.ts stripTranslationCruft().
 */
function stripTranslationCruft(translation: string): string {
  if (!translation) return translation;

  // Whitelist: phrases to preserve even if they contain Han or cruft markers
  const PRESERVE = [
    /as opposed to/i,
    /equivalent to|equivalent of/i,
    /used with|used in/i,
    /namely|e\.g\./i,
    /also written/i,
    /also pr\./i,
  ];
  const hasPreserveMarker = PRESERVE.some((p) => p.test(translation));

  // If the translation contains a preserve marker, don't strip anything
  if (hasPreserveMarker) return translation;

  // Remove trailing segments in order of prominence
  let result = translation;

  // 1. Remove classifier cruft: "; CL:…" or "(CL:…)" with all its bracketed segments
  result = result.replace(/[;,]\s*CL:[^);]*/g, "");
  result = result.replace(/\s*\(CL:[^)]*\)/gi, "");

  // 2. Remove abbreviation pointers: "(abbr. for …)" or "; abbr. for …[…]"
  result = result.replace(/\s*\(abbr\. for [^)]*\)/gi, "");
  result = result.replace(/;\s*abbr\. for [^;]*/gi, "");

  // 3. Remove variant/alternate form markers and pronunciation notes
  result = result.replace(/;\s*also (?:written|pr\.) [^;]*/gi, "");
  result = result.replace(/;\s*(?:Taiwan|coll\.) pr\. \[[^\]]*\]/gi, "");
  result = result.replace(/;\s*(?:Taiwan|coll\.) pr\. [^;]*/gi, "");

  // 4. Remove trailing place-name appositives
  result = result.replace(/;\s*\w+\s+(?:county|district|city|township|prefecture)[^;]*$/gi, "");
  result = result.replace(/,\s+\w+\s+(?:county|district|township|prefecture)[^;]*$/gi, "");

  // Trim trailing whitespace and semicolons
  result = result.trim().replace(/[;,]\s*$/, "").trim();

  return result;
}

const HAN = /[一-鿿]/;
const write = process.argv.includes("--write");
let changed = 0;
const stillHanContaining: Array<{ file: string; word: SeedWord }> = [];

for (const file of FILES) {
  const path = join(__dirname, "..", "prisma", "data", "hsk", `${file}.json`);
  const data = JSON.parse(readFileSync(path, "utf8")) as SeedWord[];
  let fileChanged = 0;

  for (const w of data) {
    if (!w.translation) continue;
    const stripped = stripTranslationCruft(w.translation);
    if (stripped !== w.translation) {
      w.translation = stripped;
      fileChanged++;
      if (HAN.test(stripped)) {
        stillHanContaining.push({ file, word: w });
      }
    }
  }

  if (fileChanged && write) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  if (fileChanged) console.log(`${file}: ${fileChanged} translations cleaned`);
  changed += fileChanged;
}

console.log(`\n${write ? "WROTE" : "DRY RUN"} — ${changed} translations cleaned.`);

if (stillHanContaining.length > 0) {
  console.log(
    `\nCandidates for manual curation (still contain Han after cruft strip): ${stillHanContaining.length}`
  );
  stillHanContaining.forEach(({ file, word }) => {
    console.log(`  ${file} ${word.term}: "${word.translation}"`);
  });
}
