# CC-CEDICT lookup data

`cedict.json.gz` is a trimmed build of the
[CC-CEDICT](https://cc-cedict.org/wiki/) Chinese–English dictionary,
keyed by simplified and traditional headword, with pinyin and up to three
meanings per entry. It powers the word-entry suggestions for Chinese lists.

CC-CEDICT is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). The data is © the CC-CEDICT editors and contributors;
download source: <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>.

To rebuild, download the current release and re-run the trim (keep the first
three non-variant meanings per entry, cap three homograph entries per key).
