# HSK vocabulary data

`hsk1.json` … `hsk6.json` contain the HSK 2.0 vocabulary lists (levels 1–6),
one entry per word: `{ term, translation, phonetic, metadata: { level, pos?, frequencyRank? } }`.
Terms are simplified characters, `phonetic` is pinyin with tone marks, and
`translation` joins the top senses with `; `.

Derived from the open-source dataset
[complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
by Yanis Zafirópulos, used under the MIT License. See that repository for the
full license text and the richer source data (traditional forms, additional
transcriptions, HSK 3.0 levels).
