// Shorten grammar-particle leads to textbook-style function labels.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const p = join(__dirname, "..", "prisma", "data", "hsk", "curated", "new1.json");
const c = JSON.parse(readFileSync(p, "utf8"));

c["了"] = {
  translation: "completed-action particle; to finish",
  meanings: [
    { gloss: "completed-action particle" },
    { gloss: "modal particle indicating change of state" },
    { gloss: "to finish; to understand clearly", reading: "liǎo" },
  ],
};
c["吗"] = {
  translation: "question particle (yes-no)",
  meanings: [
    { gloss: "question particle (yes-no questions)" },
    { gloss: "(coll.) what?", reading: "má" },
  ],
};
c["呢"] = {
  translation: 'topic particle ("What about …?")',
  meanings: [
    { gloss: 'topic particle ("What about …?")' },
    { gloss: 'particle for asking location ("Where …?")' },
  ],
};
c["吧"] = {
  translation: 'suggestion particle ("Let\'s …")',
  meanings: [
    { gloss: 'suggestion particle ("Let\'s …")' },
    { gloss: "…right?" },
    { gloss: "bar (loanword)" },
  ],
};

writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
for (const t of ["了", "吗", "呢", "吧"]) console.log(t, "->", c[t].translation);
