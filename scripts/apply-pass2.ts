/**
 * Pass-2 application:
 *  1. Fill the 12 "[entry missing from cedict]" placeholder entries from the
 *     full CC-CEDICT export (pure retrieval — senses copied verbatim).
 *  2. Merge pass-2 audit proposals into curated/new{1..7}.json.
 *  3. Apply the three human-approved flips (待/正当/分量): curated override
 *     + generated-file phonetic patch (curated layer cannot touch phonetic).
 *
 *   npx tsx scripts/apply-pass2.ts            (dry run)
 *   npx tsx scripts/apply-pass2.ts --write
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

import { promoteCleanLead } from "../src/lib/glossGuard";
import { normalizePinyin, stripTranslationCruft } from "../src/lib/hskTransform";

const TMP = "C:/Users/mrks/AppData/Local/Temp/opencode/hsk-audit";
const write = process.argv.includes("--write");
const DATA = join(__dirname, "..", "prisma", "data", "hsk");

type Meaning = { gloss: string; reading?: string };
type Override = { translation?: string; meanings?: Meaning[] };
type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: { meanings?: Meaning[] } & Record<string, unknown>;
};

// ---- full cedict ----
const cedText = gunzipSync(readFileSync(join(TMP, "cedict-full.gz"))).toString("utf8");
const cedict = new Map<string, { py: string; eng: string }[]>();
for (const line of cedText.split("\n")) {
  if (line.startsWith("#")) continue;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[(.*?)\]\s+\/(.*)\/\s*$/);
  if (!m) continue;
  const [, , simp, py, eng] = m;
  if (!cedict.has(simp)) cedict.set(simp, []);
  cedict.get(simp)!.push({ py, eng });
}

let filled = 0;
// cedict-absent placeholders fall back to the HanziStroke HSK list (verbatim defs).
const PDF_FALLBACK: Record<string, { py: string; eng: string }> = {
  居于: { py: "ju1 yu2", eng: "to be located in/to be situated at" },
  揠苗助长: { py: "ya4 miao2 zhu4 zhang3", eng: "to pull up seedlings to help them grow (idiom)/fig. ruin sth by being over-eager" },
  精彩纷呈: { py: "jing1 cai3 fen1 cheng2", eng: "wonderful and exciting (variety)/splendid things in profusion" },
};
for (let L = 1; L <= 7; L++) {
  const path = join(DATA, `new${L}.json`);
  const data = JSON.parse(readFileSync(path, "utf8")) as SeedWord[];
  let n = 0;
  for (const w of data) {
    if (!(w.translation || "").includes("[entry missing")) continue;
    let py: string | null = null;
    let eng: string | null = null;
    const hits = cedict.get(w.term);
    if (hits && hits.length > 0) {
      py = hits[0].py;
      eng = hits[0].eng;
    } else if (PDF_FALLBACK[w.term]) {
      py = PDF_FALLBACK[w.term].py;
      eng = PDF_FALLBACK[w.term].eng;
    }
    if (!py || !eng) continue;
    const glosses = eng.split("/").filter(Boolean);
    w.phonetic = normalizePinyin(py);
    w.translation = stripTranslationCruft(glosses.slice(0, 2).join("; "));
    w.metadata.meanings = glosses.slice(0, 3).map((gloss) => ({ gloss }));
    n++;
    filled++;
  }
  if (n && write) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  if (n) console.log(`new${L}: filled ${n} placeholders`);
}
console.log(`placeholders filled: ${filled}`);

// ---- pass-2 proposals into curated ----
const proposals = JSON.parse(readFileSync(join(TMP, "p2-proposals.json"), "utf8")) as Record<
  string,
  Record<string, Override>
>;
let mergedTotal = 0;
for (let L = 1; L <= 7; L++) {
  const props = proposals[String(L)];
  if (!props) continue;
  const curPath = join(DATA, "curated", `new${L}.json`);
  const curated = JSON.parse(readFileSync(curPath, "utf8")) as Record<string, Override>;
  const raw = JSON.parse(readFileSync(join(DATA, `new${L}.json`), "utf8")) as SeedWord[];
  const phonByTerm = new Map(raw.map((w) => [w.term, w.phonetic]));
  let merged = 0;
  const notes: string[] = [];
  for (const [term, ov] of Object.entries(props)) {
    const phonetic = phonByTerm.get(term);
    if (phonetic === undefined) { notes.push(`${term}: not found`); continue; }
    // translation fallback when agent left it blank
    const translation =
      ov.translation || (ov.meanings ?? []).map((m) => m.gloss).join("; ");
    const guard = promoteCleanLead(ov.meanings ?? [], phonetic);
    if (guard.changed) notes.push(`${term}: guard demoted -> ${guard.meanings[0].gloss}`);
    curated[term] = { translation, meanings: guard.changed ? guard.meanings : ov.meanings };
    merged++;
  }
  if (merged && write) writeFileSync(curPath, JSON.stringify(curated, null, 2) + "\n");
  console.log(`curated/new${L}.json: ${merged} merged${notes.length ? " | " + notes.join("; ") : ""}`);
  mergedTotal += merged;
}
console.log(`proposals merged: ${mergedTotal}`);

// ---- three approved flips ----
const FLIPS: Record<string, { file: number; phonetic: { from: string; to: string }; override: Override }> = {
  待: {
    file: 4,
    phonetic: { from: "dài", to: "dāi" },
    override: {
      translation: "to stay; to wait",
      meanings: [
        { gloss: "to stay; to remain" },
        { gloss: "to wait", reading: "dài" },
        { gloss: "to treat", reading: "dài" },
        { gloss: "to deal with", reading: "dài" },
      ],
    },
  },
  正当: {
    file: 7,
    phonetic: { from: "zhèng dāng", to: "zhèng dàng" },
    override: {
      translation: "honest; reasonable; fair",
      meanings: [
        { gloss: "honest; upright" },
        { gloss: "reasonable; fair; sensible" },
        { gloss: "timely; just (when needed)", reading: "zhèng dāng" },
      ],
    },
  },
  分量: {
    file: 7,
    phonetic: { from: "fēn liàng", to: "fèn liang" },
    override: {
      translation: "weight; importance",
      meanings: [
        { gloss: "quantity; weight; measure" },
        { gloss: "(fig.) weight; importance; prestige" },
        { gloss: "(food) portion size", reading: "fèn liàng" },
      ],
    },
  },
};

for (const [term, flip] of Object.entries(FLIPS)) {
  const genPath = join(DATA, `new${flip.file}.json`);
  const genData = JSON.parse(readFileSync(genPath, "utf8")) as SeedWord[];
  const w = genData.find((x) => x.term === term);
  if (!w) { console.log(`flip ${term}: NOT FOUND in new${flip.file}`); continue; }
  const curPath = join(DATA, "curated", `new${flip.file}.json`);
  const curated = JSON.parse(readFileSync(curPath, "utf8")) as Record<string, Override>;
  let didPhonetic = false;
  if (w.phonetic === flip.phonetic.from) {
    w.phonetic = flip.phonetic.to;
    didPhonetic = true;
  } else {
    console.log(`flip ${term}: phonetic is '${w.phonetic}', expected '${flip.phonetic.from}' — skipping phonetic patch`);
  }
  curated[term] = flip.override;
  if (write) {
    writeFileSync(genPath, JSON.stringify(genData, null, 2) + "\n");
    writeFileSync(curPath, JSON.stringify(curated, null, 2) + "\n");
  }
  console.log(`flip ${term}: applied (${didPhonetic ? "phonetic + curated" : "curated only"})`);
}

console.log(`\n${write ? "WROTE" : "DRY RUN"} — done.`);
