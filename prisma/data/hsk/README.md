# Chinese vocabulary data

`new1.json` … `new7.json` contain the **New HSK 3.0 (2021 standard)**
vocabulary lists — levels 1–6 plus the 7–9 band — and `freq100.json` /
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

(The legacy `hsk1.json` … `hsk6.json` files are the old HSK 2.0 lists, kept
only so existing installs whose users studied them keep working.)

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
