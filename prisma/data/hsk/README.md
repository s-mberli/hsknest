# Chinese vocabulary data

`new1.json` … `new7.json` contain the **New HSK 3.0 (2021 standard)**
vocabulary lists — levels 1–6 plus the 7–9 band — and `freq100.json` /
`freq1000.json` contain the highest-frequency words overall, ordered by
real-world usage rank. One entry per word:
`{ term, translation, phonetic, metadata: { level, pos?, frequencyRank?, traditional? } }`.
Terms are simplified characters, `phonetic` is pinyin with tone marks, and
`translation` joins the top senses with `; `.

(The legacy `hsk1.json` … `hsk6.json` files are the old HSK 2.0 lists, kept
only so existing installs whose users studied them keep working.)

Derived from the open-source dataset
[complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
by Yanis Zafirópulos, used under the MIT License. See that repository for the
full license text and the richer source data (traditional forms, additional
transcriptions). Frequency ordering uses the `frequency` ranks included in
that dataset.
