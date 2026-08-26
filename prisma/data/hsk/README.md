# Chinese vocabulary data

`new1.json` … `new7.json` contain the **New HSK 3.0 vocabulary (November 2025
syllabus, effective July 2026)** lists — levels 1–6 plus the 7–9 band — and `freq100.json` /
`freq1000.json` contain the highest-frequency words overall, ordered by
real-world usage rank. One entry per word:
`{ term, translation, phonetic, metadata: { level, pos?, frequencyRank?, traditional?, meanings } }`.
Terms are simplified characters, `phonetic` is pinyin with tone marks,
`translation` is a short card-friendly string joining the first senses with
`; `, and `metadata.meanings` holds the full structured sense list as
`[{ gloss, reading? }]` — `reading` is set when a sense belongs to a
different pronunciation than `phonetic` (e.g. 了 le vs. liǎo).

Regenerate these files with `scripts/generate-hsk-data.ts` (see its header
for the dataset download command):

```
npx tsx scripts/generate-hsk-data.ts <path-to-complete.json>
```

**Sense ordering is curated.** CC-CEDICT sometimes ranks a proper-noun or
abbreviation sense first (e.g. 新 → "abbr. for Xinjiang", 女孩儿 → "erhua
variant of 女孩"), which is wrong to lead with for a learner who only sees the
first sense. `scripts/fix-primary-glosses.ts` promotes the first genuinely
common sense to the front (and rebuilds `translation`) for those cases, while
leaving correct proper nouns (中国 = China, 长城 = the Great Wall) untouched. It
is idempotent — re-run after any regeneration:

```
npx tsx scripts/fix-primary-glosses.ts --write      # then re-seed, or:
npx tsx scripts/fix-hsk-meanings.ts                 # push into an existing DB, preserving progress
```

**Do not bypass the bad-lead guard when editing curated overrides.**
`src/lib/glossGuard.ts` (`isBadLead` / `promoteCleanLead`) is the single
source of truth for "what may lead a card": dictionary plumbing
(abbr./variant/see-/surname pointers, pure grammar labels) and proper-noun
readings must never be a card's first sense. It is enforced at three points —
`fix-primary-glosses.ts` (generated files), `compile-curated-glosses.ts`
(curated compilation), and a seed-time tripwire warning in `prisma/seed.ts`.
If an edit "doesn't take" or a warning fires, the guard is rejecting a bad
lead on purpose (past incidents: 联想 = "Lenovo", 富裕 = a county name) — fix
the gloss order, don't remove the guard. Background:
`audits/hsk-gloss-audit-2026-08.md` (local-only).

(The legacy `hsk1.json` … `hsk6.json` files — the old HSK 2.0 lists — were
removed once the app migrated to the HSK 3.0 lists above (November 2025
syllabus, effective July 2026). Seeding matches an existing list by name and
replaces its content wholesale,
so no install ever depended on the old files being present; see
`scripts/migrate-hsk-levels.ts` for the 2.0 → 3.0 migration itself.)

Derived from the open-source dataset
[complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
by Yanis Zafirópulos, used under the MIT License. See that repository for the
full license text and the richer source data (traditional forms, additional
transcriptions). Frequency ordering uses the `frequency` ranks included in
that dataset.

## Example sentences

`sentences.json` contains Chinese↔English example sentences derived from
[Tatoeba](https://tatoeba.org) (via the
[manythings.org Anki pair file](https://www.manythings.org/anki/)), licensed
**CC-BY 2.0 (France)** — each sentence keeps its per-sentence attribution
string in `source`. Only sentences fully covered by the vendored HSK
vocabulary are included (at most 3 per word, shortest first), so every
sentence links to studyable words. One entry per sentence:
`{ text, translation, source, terms, metadata: { level } }` where `level` is
the highest HSK level among the words used.

Regenerate with:

```
npx tsx scripts/generate-sentences.ts <path-to-cmn.txt>
```

(see the script header for the download command; run
`generate-hsk-data.ts` first if the word data changed).
