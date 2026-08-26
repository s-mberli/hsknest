// Merge audit proposals into prisma/data/hsk/curated/new{1..7}.json.
// - Preserves existing curated entries not touched by the audit.
// - AMENDMENTS apply post-audit corrections (full-CEDICT cross-check).
// - Every merged entry is re-validated with promoteCleanLead; failures are
//   logged and skipped rather than written.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { promoteCleanLead } from "../src/lib/glossGuard";

const TMP = "C:/Users/mrks/AppData/Local/Temp/opencode/hsk-audit";
const REPO = "C:/Users/mrks/Documents/claude project";
const write = process.argv.includes("--write");

// Post-cross-check amendments (see audits report §verification).
const AMENDMENTS = {
  // Full CEDICT lists only "variation"; soften to noun pair + drop unsourced verb.
  变异: {
    translation: "variation; mutation",
    meanings: [{ gloss: "variation" }, { gloss: "mutation (e.g. of a virus)" }],
  },
};

type Override = { translation: string; meanings: { gloss: string }[] };

let totalMerged = 0;
for (let L = 1; L <= 7; L++) {
  let proposals: Record<string, Override>;
  try {
    proposals = JSON.parse(
      readFileSync(join(TMP, `curated-proposal-new${L}.json`), "utf8")
    ) as Record<string, Override>;
  } catch {
    continue;
  }
  const amendments = AMENDMENTS as Record<string, Override>;
  for (const [k, v] of Object.entries(amendments)) proposals[k] = v;

  const curPath = join(REPO, `prisma/data/hsk/curated/new${L}.json`);
  const curated = JSON.parse(readFileSync(curPath, "utf8")) as Record<string, Override>;
  const raw = JSON.parse(readFileSync(join(REPO, `prisma/data/hsk/new${L}.json`), "utf8")) as {
    term: string;
    phonetic: string;
  }[];
  const phoneticByTerm = new Map(raw.map((w) => [w.term, w.phonetic]));

  let merged = 0;
  const skipped = [];
  for (const [term, override] of Object.entries(proposals)) {
    const phonetic = phoneticByTerm.get(term);
    if (!phonetic) {
      skipped.push(`${term}: not in new${L}.json`);
      continue;
    }
    const guard = promoteCleanLead(override.meanings, phonetic);
    if (guard.changed) {
      skipped.push(`${term}: guard demoted lead -> ${guard.meanings[0].gloss}`);
      override.meanings = guard.meanings;
    }
    curated[term] = override;
    merged++;
  }

  if (merged && write) writeFileSync(curPath, JSON.stringify(curated, null, 2) + "\n");
  console.log(`new${L}: ${merged} merged${skipped.length ? " | notes: " + skipped.join("; ") : ""}`);
  totalMerged += merged;
}
console.log(`\n${write ? "WROTE" : "DRY RUN"} — ${totalMerged} curated entries`);
