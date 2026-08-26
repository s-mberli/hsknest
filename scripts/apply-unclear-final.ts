/**
 * Apply the 13 final UNCLEAR resolutions (human-approved 2026-08-26).
 * Curated overrides + generated-file phonetic patches where needed.
 *   npx tsx scripts/apply-unclear-final.ts            (dry run)
 *   npx tsx scripts/apply-unclear-final.ts --write
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const DATA = join(__dirname, "..", "prisma", "data", "hsk");

type Meaning = { gloss: string; reading?: string };
type Override = { translation?: string; meanings?: Meaning[] };
type W = { term: string; translation?: string; phonetic?: string; metadata?: { meanings?: Meaning[] } };

// term -> { level, phonetic patch (optional), override }
const RES: Record<string, { level: number; phonetic?: { from: string; to: string }; override: Override; note: string }> = {
  喂: {
    level: 1,
    override: {
      translation: "hello (on the phone); to feed",
      meanings: [
        { gloss: "hello (when answering the phone)" },
        { gloss: "hey" },
        { gloss: "to feed (an animal, baby etc)" },
      ],
    },
    note: "phone-hello is wèi universally taught",
  },
  使馆: {
    level: 4,
    override: {
      translation: "embassy; diplomatic mission",
      meanings: [
        { gloss: "embassy (abbr. of 大使馆)" },
        { gloss: "consulate; diplomatic mission" },
      ],
    },
    note: "pdf right — 使馆 = embassy",
  },
  历年: {
    level: 6,
    override: {
      translation: "over the years; (stats) calendar year",
      meanings: [
        { gloss: "over the years; in past years" },
        { gloss: "(stats register) calendar year" },
      ],
    },
    note: "everyday sense leads",
  },
  蒙: {
    level: 7,
    override: {
      translation: "to cover; to deceive",
      meanings: [
        { gloss: "to cover" },
        { gloss: "ignorant; dim-sighted; to receive (favor)" },
        { gloss: "to deceive; to make a wild guess (coll.)", reading: "mēng" },
        { gloss: "Mongolia (abbr.)", reading: "Měng" },
      ],
    },
    note: "mēng deceive sense added with explicit reading",
  },
  本事: {
    level: 7,
    phonetic: { from: "běn shì", to: "běn shi" },
    override: {
      translation: "skill; ability",
      meanings: [
        { gloss: "skill; ability; capability (coll.)" },
        { gloss: "source material; original story (literary)", reading: "běn shì" },
      ],
    },
    note: "intended HSK word is běnshi skill",
  },
  壳: {
    level: 7,
    override: {
      translation: "shell; hard outer covering",
      meanings: [
        { gloss: "(bound form) shell; crust (地壳， 地壳运动)" },
        { gloss: "(coll., everyday) shell of an egg, nut etc; casing; housing", reading: "ké" },
      ],
    },
    note: "qiào lead per official list; ké tagged colloquial",
  },
  时事: {
    level: 7,
    override: {
      translation: "current events; current affairs",
      meanings: [{ gloss: "current events; current affairs; news of the day" }],
    },
    note: "ced gloss described 时势； pdf sense is the word's meaning",
  },
  猩猩: {
    level: 7,
    override: {
      translation: "orangutan",
      meanings: [{ gloss: "orangutan" }],
    },
    note: "chimpanzee = 黑猩猩； pdf wrong",
  },
  倔: {
    level: 7,
    phonetic: { from: "juè", to: "jué" },
    override: {
      translation: "stubborn; gruff",
      meanings: [
        { gloss: "stubborn; unbending; gruff (of speech)" },
        { gloss: "(only in 倔强 jué jiàng)", reading: "jué" },
      ],
    },
    note: "jué standard per Putonghua guides",
  },
  熨: {
    level: 7,
    override: {
      translation: "to iron; to press (clothes)",
      meanings: [
        { gloss: "to iron; to press (clothes) (熨衣服， 熨斗)" },
        { gloss: "(literary) smooth; reconciled (熨帖)", reading: "yù" },
      ],
    },
    note: "learner sense is yùn",
  },
  没准儿: {
    level: 7,
    phonetic: { from: "méi zhun r", to: "méi zhǔnr" },
    override: undefined as unknown as Override,
    note: "phonetic normalization only — senses already correct",
  },
};

// terms resolved with NO change (documented non-issues)
const NO_CHANGE: Record<string, string> = {
  呵: "hē vs he1 identical notation — no change",
  扫帚: "sào zhou matches ced sao4 zhou5 — no change",
  猩猩: "already orangutan (followed ced, which is right) — no change needed",
};

let applied = 0;
for (const [term, res] of Object.entries(RES)) {
  if (!res.override && !res.phonetic) continue;
  const genPath = join(DATA, `new${res.level}.json`);
  const genData = JSON.parse(readFileSync(genPath, "utf8")) as W[];
  const w = genData.find((x) => x.term === term);
  if (!w) { console.log(`${term}: NOT FOUND in new${res.level}`); continue; }

  let didPhon = false;
  if (res.phonetic) {
    if (w.phonetic === res.phonetic.from) {
      w.phonetic = res.phonetic.to;
      didPhon = true;
    } else if (w.phonetic === res.phonetic.to) {
      didPhon = true; // already patched
    } else {
      console.log(`${term}: phonetic '${w.phonetic}' ≠ expected '${res.phonetic.from}' — patching anyway to '${res.phonetic.to}'`);
      w.phonetic = res.phonetic.to;
      didPhon = true;
    }
  }
  if (write && (didPhon || res.override)) writeFileSync(genPath, JSON.stringify(genData, null, 2) + "\n");

  if (res.override) {
    const curPath = join(DATA, "curated", `new${res.level}.json`);
    const cur = JSON.parse(readFileSync(curPath, "utf8")) as Record<string, Override>;
    cur[term] = res.override;
    if (write) writeFileSync(curPath, JSON.stringify(cur, null, 2) + "\n");
  }
  applied++;
  console.log(`${term} [new${res.level}]: ${res.note}${didPhon ? " (+phonetic)" : ""}`);
}
for (const [t, why] of Object.entries(NO_CHANGE)) console.log(`${t}: ${why}`);
console.log(`\n${write ? "WROTE" : "DRY RUN"} — ${applied} entries processed`);
