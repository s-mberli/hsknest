# Importing your own vocabulary

HSK Nest ships Mandarin-first, but the engine is language-agnostic — you can
add **any language** and **any vocabulary** yourself, with no config files, no
restart, and no schema changes. This page is the exact format spec plus a
ready-made prompt for generating decks with an LLM.

- [Quick start](#quick-start)
- [Format spec](#format-spec)
- [Generating a deck with AI](#generating-a-deck-with-ai)
- [Adding a new language](#adding-a-new-language)
- [Reading the import summary](#reading-the-import-summary)
- [Troubleshooting](#troubleshooting)

## Quick start

1. **Lists → New list** → give it a name and pick (or create) a language.
2. Open the list → **Import batch**.
3. Paste your words, one per line:

```
你好,hello
谢谢,thank you
```

4. Check the column mapping shown above the preview, then import.

That's it. Tab-separated works identically — paste straight from a spreadsheet.

## Format spec

### Columns

The default mapping is **term → translation → phonetic**, in that order:

```
term,translation,phonetic
```

| # | Role | Required | Notes |
|---|---|---|---|
| 1 | `term` | **yes** | The word you're learning. Rows with an empty term are skipped. |
| 2 | `translation` | no | Meaning in your language. May be empty. |
| 3 | `phonetic` | no | Reading/pronunciation (pinyin, romaji, IPA — anything). |

> **The reading is the *third* column, not the second.** A very common mistake
> is pasting `term, pinyin, meaning` — you'll get your pinyin stored as the
> translation. Check the preview before importing.

You can **remap any column** in the import UI (including `ignore` for columns
you don't want, and `meanings` for multi-sense words — see below). Extra
columns beyond the ones you map are ignored, so you can paste a wide
spreadsheet export and just map the three you care about.

A one-column paste is valid — you get terms with no translation.

### Delimiters

**Tab or comma only.** Detection is automatic: if the first non-blank line
contains a tab, the whole file is treated as tab-separated; otherwise comma.

Semicolons are *not* a delimiter — they're the separator *inside* the
`meanings` column.

Fields may be double-quoted, which is how you include a comma in a value.
A literal quote inside a quoted field is escaped by doubling it:

```
"看",to look; to see,kàn
"say ""hello""",a greeting,
```

CRLF and LF line endings both work. Blank lines are skipped silently.

### Multi-sense words (`meanings`)

Map a column to **`meanings`** and separate senses with semicolons:

```
行,to walk; capable; OK,xíng
```

Each sense is stored separately (used by quiz distractors and the word
browser). If you leave `translation` empty but provide `meanings`, the first
three senses are joined to fill the translation automatically.

### Limits

| Limit | Value |
|---|---|
| Paste size | 100,000 characters |
| Rows per import | 2,000 |
| Term length | 200 chars (longer rows are **skipped**) |
| Translation length | 500 chars (truncated) |
| Phonetic length | 200 chars (truncated) |
| Senses per word | 20 (extra dropped) |
| Imports per hour | 20 |

For a bigger deck, split it into several imports of ≤2,000 rows.

### Header rows are NOT detected

There is no header detection. A first line of `term,translation,phonetic`
will be imported as a **word** literally called "term". **Delete the header
row before pasting.**

### Anki

HSK Nest can't read binary `.apkg` files (uploading one gives a clear error).
Export as text instead:

**Anki → File → Export → "Notes in Plain Text" (.txt)** → paste or upload the
result. It's tab-separated, so it maps cleanly. Use the column mapper to
`ignore` any Anki columns you don't need (tags, GUIDs, note type).

## Generating a deck with AI

Because the format is plain text, any LLM (Claude, ChatGPT, a local Llama —
whatever you already self-host) can generate a deck. Copy this prompt and
edit the bracketed parts:

```text
Generate a vocabulary deck as plain CSV for import into a flashcard app.

Language: [German]
Level/topic: [A1 everyday conversation]
Number of words: [100]
Translate into: [English]

STRICT FORMAT RULES — follow exactly:
- Output ONLY raw CSV. No markdown fences, no commentary, no header row.
- Exactly 3 columns per line, in this order:
  1. the word in [German]
  2. the [English] translation
  3. the pronunciation/reading (leave empty if not applicable, but keep the comma)
- One word per line.
- If a field contains a comma, wrap that field in double quotes.
- For words with several distinct meanings, separate them with semicolons
  inside the translation field, e.g.  laufen,"to run; to walk; to function",
- No duplicate words.
- Order from most to least common.
```

Paste the output straight into **Import batch**. Spot-check a few entries
before studying — LLMs are good at common vocabulary and less reliable on
rare words, tones, and gendered nouns.

> **Tip:** ask for 100–300 words at a time. Longer generations drift in
> quality and are more likely to repeat themselves (duplicates are skipped
> on import anyway, so you'd silently get a smaller deck than you asked for).

## Adding a new language

You don't need to touch the database or any config:

1. **Lists → New list**
2. In the **Language** dropdown, choose **+ new language**
3. Enter a name and a short code — e.g. `Japanese` / `ja`

The list is then yours to fill via import or manual entry.

**What a new language gets — and doesn't:**

| | Bundled languages | Your own language |
|---|---|---|
| Scheduling (FSRS/SM-2/Leitner) | ✅ | ✅ |
| All study & practice modes | ✅ | ✅ |
| CSV import / export | ✅ | ✅ |
| Pre-generated Azure audio | Mandarin, German | ❌ |
| Browser text-to-speech | ✅ | ✅ *(if your OS has a voice for it — see [CONFIGURATION.md](CONFIGURATION.md#audio))* |
| Dictionary-assisted entry | Mandarin (CC-CEDICT) | ❌ |
| Graded level lists | Mandarin (HSK 1–9) | ❌ |

The scheduler, which is the actual product, treats every language identically.

## Reading the import summary

After an import you get counts, not just a total:

| Field | Meaning |
|---|---|
| `added` | Words actually created. |
| `noTerm` | Rows whose term column was empty. |
| `duplicateInPaste` | The same term appeared earlier in *this* paste (case-insensitive; the first one wins). |
| `alreadyInList` | That term is already in this list (case-insensitive). |
| `overCap` | Dropped because the 2,000-row limit was reached. |
| `invalid` | Term longer than 200 characters. |

A large `alreadyInList` on a re-import is normal and harmless — importing the
same file twice will not create duplicates.

## Troubleshooting

**My first word looks corrupted / has an invisible character.**
Older versions didn't strip the UTF-8 byte-order mark that Excel's "CSV UTF-8"
and Google Sheets add. This is fixed — re-import, and delete the affected word.

**Everything landed in one column.**
Your file probably uses semicolons (common in German/French locale Excel).
Re-save as comma- or tab-separated, or find-and-replace the semicolons.

**My pinyin shows up as the meaning.**
Column order is term → translation → phonetic. Remap columns in the import UI.

**A word imported as "term" / "word" / "Front".**
That was your header row. Delete it and re-import; remove the bogus word from
the list.

**Nothing imported and I got a rate-limit error.**
20 imports per hour per account. Wait, or combine files into fewer, larger
imports.

**I want the words in a specific study order.**
Import order is preserved as the list's word order, and new words are
introduced in that order. Sort your file before importing.
