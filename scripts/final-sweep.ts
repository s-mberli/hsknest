// Final residue sweep: empty fields, style violations, guard violations, orphans.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isBadLead, type GuardedGloss } from "../src/lib/glossGuard";

type W = { term: string; translation?: string; phonetic?: string; metadata?: { meanings?: { gloss: string; reading?: string }[] } };

const stats = {
  emptyTranslation: 0, emptyPhonetic: 0, missingMeanings: 0,
  numberedPinyin: 0, colonPinyin: 0,
  dupInFile: 0, orphanCurated: 0, badLeadCurated: 0, emptyOverride: 0,
};
const details: string[] = [];

for (let L = 1; L <= 7; L++) {
  const raw = JSON.parse(readFileSync(join(__dirname, "..", "prisma/data/hsk", `new${L}.json`), "utf8")) as W[];
  const cur = JSON.parse(readFileSync(join(__dirname, "..", "prisma/data/hsk/curated", `new${L}.json`), "utf8")) as Record<string, Override>;
  const seen = new Set<string>();
  for (const w of raw) {
    if (!w.translation || !String(w.translation).trim()) { stats.emptyTranslation++; details.push(`EMPTY-TR new${L} ${w.term}`); }
    if (!w.phonetic || !String(w.phonetic).trim()) { stats.emptyPhonetic++; details.push(`EMPTY-PH new${L} ${w.term}`); }
    if (!Array.isArray(w.metadata?.meanings) || w.metadata.meanings!.length === 0) stats.missingMeanings++;
    if (/[a-z][1-5]/.test(String(w.phonetic))) { stats.numberedPinyin++; details.push(`NUMBERED new${L} ${w.term}[${w.phonetic}]`); }
    if (String(w.phonetic).includes(":")) { stats.colonPinyin++; details.push(`COLON new${L} ${w.term}[${w.phonetic}]`); }
    if (seen.has(w.term)) { stats.dupInFile++; details.push(`DUP new${L} ${w.term}`); }
    seen.add(w.term);
  }
  for (const [t, o] of Object.entries(cur)) {
    const gen = raw.find((w) => w.term === t);
    if (!gen) { stats.orphanCurated++; details.push(`ORPHAN curated new${L}: ${t}`); continue; }
    if (!o.translation && !o.meanings) { stats.emptyOverride++; details.push(`EMPTY-OVERRIDE curated new${L}: ${t}`); continue; }
    const ms = (o.meanings ?? []).map((m) => ({ gloss: m.gloss ?? "", reading: m.reading })) as GuardedGloss[];
    if (ms.length && ms[0].gloss && isBadLead(ms[0], String(gen.phonetic))) {
      stats.badLeadCurated++;
      details.push(`BAD-LEAD curated new${L}: ${t} -> ${ms[0].gloss.slice(0, 60)}`);
    }
  }
}

console.log(JSON.stringify(stats, null, 1));
if (details.length) console.log(details.join("\n"));
else console.log("no detail findings");

type Override = { translation?: string; meanings?: { gloss: string; reading?: string }[] };
