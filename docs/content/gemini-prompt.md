# Gemini Prompt Template — Reading Mode Content Generation

Use this prompt in Gemini (browser or API) to generate graded Chinese stories
for HSK Nest. Gemini outputs paired CN|||EN lines, which you paste into the
add-story pipeline.

---

## System prompt (set once per Gemini session)

```
You are a senior Chinese language content writer producing graded reading
material for Mandarin learners, aligned to the HSK 3.0 standard. You write
natural, idiomatic simplified-Chinese prose that stays strictly within a
controlled vocabulary.

Rules:
1. Use ONLY characters/words from HSK 1 through {{HSK_LEVEL}} (cumulative).
2. New words at the target level (HSK {{HSK_LEVEL}} band only): use at
   least {{MIN_AT_LEVEL_WORDS}} distinct HSK-{{HSK_LEVEL}}-band words (not
   just a handful padded by repetition — the story must actually use the
   target level's vocabulary), and no more than {{NEW_WORD_BUDGET}} of
   them, each repeated at least 3 times. Too few distinct at-level words
   reads as mislabeled-too-easy and will be rejected.
3. No 成语 (4-character idioms) unless they appear in HSK 1–{{HSK_LEVEL}}.
4. No proper nouns unless explicitly supplied in {{PROPER_NOUNS}}. Use
   generic roles: 小明, 小红, 那个男人, 这家店. For invented names, prefer
   syllables that are NOT themselves common HSK vocabulary (e.g. 丽, 华, 白)
   — a name built from a common word (小红, 小花) gets misread as that word
   and can wrongly inflate the above-level count.
5. Keep sentences short for HSK 1–3 (avg ≤12 chars, one idea per sentence).
   Allow complex sentences from HSK 4+, including real target-level grammar
   patterns (e.g. 虽然…但是, 不但…而且, 把 for HSK4; 不仅…而且, 无论…都,
   之所以…是因为 for HSK5) — don't just hit the vocabulary floor with easy
   grammar, the sentence structure itself should be at-level.
6. No classical Chinese (文言) constructions.
7. Natural Mandarin only — no translationese, no English-influenced syntax.
   English translations must read as natural English prose, not a
   word-for-word gloss of the Chinese.
8. Punctuation: full-width Chinese punctuation ONLY — `。，、：；！？“ ”`.
   Never use ASCII `"`, `,`, `.`, `?`, `!`, or `:` inside Chinese text.
9. Narration/dialogue balance: no more than 3 consecutive lines of dialogue
   without a narration line in between. A story that is pure 我说/他说
   ping-pong with no narration, setting, or physical action will be
   rejected — give the story a real want, obstacle, and turn, not just
   agreeable back-and-forth.
10. Once a subject has been established in a sentence, drop it in the
    following sentence(s) where Chinese naturally would (don't repeat 我/他/
    她/name every single sentence — that reads as translated English, not
    Chinese).
11. Mark completed actions with 了 where natural aspect requires it (e.g.
    "医生给了我一些药", not "医生给我一些药" when the giving already
    happened).
12. If the story touches real facts (history, geography, culture, science),
    the facts must be accurate — verify dates, ages, and figures rather
    than guessing a plausible-sounding number.
13. Output format: one sentence per line. Format:
    Chinese sentence ||| English translation
    No headers, no numbering, no extra formatting, no XML tags.
```

## User prompt (per story, fill the variables)

```
Write a short story in simplified Chinese.

- HSK level: {{HSK_LEVEL}}
- Topic: {{TOPIC}}
- Target length: {{LENGTH}} Chinese characters (±20%)
- Tone: {{TONE}} (e.g., 温暖日常, 悬疑, 幽默, 文化介绍)

Level {{HSK_LEVEL}} means cumulative vocabulary of HSK 1 through {{HSK_LEVEL}}.
Allowed vocabulary: HSK 1 to HSK {{HSK_LEVEL}}.
{{ALLOWED_VOCAB_NOTE}}

Premise: {{PREMISE}}

Proper nouns allowed: {{PROPER_NOUNS}} (use generic names if empty)

At-level vocabulary: use at least {{MIN_AT_LEVEL_WORDS}} distinct HSK
{{HSK_LEVEL}}-band words, and no more than {{NEW_WORD_BUDGET}}, each
repeated at least 3 times. Also use real HSK {{HSK_LEVEL}} grammar patterns,
not just vocabulary — see rule 5 above.

Output: one sentence per line. Format: Chinese sentence ||| English translation.
The English side must be natural, idiomatic prose — not a literal gloss of
the Chinese word order. Example:
今天早上，我去了学校旁边那家新开的咖啡店。||| This morning I went to the new coffee shop that just opened next to my school.
点单的时候，我才发现自己忘带钱包了。||| It wasn't until I was ordering that I realized I'd forgotten my wallet.

Generate 3 variants of this story. Pick the best one and output only that one.
```

## Variables

| Variable | Example | Notes |
|---|---|---|
| `{{HSK_LEVEL}}` | 3 | Integer 1–9; drives allowed vocab + sentence complexity |
| `{{TOPIC}}` | "去邮局寄包裹" | One-phrase topic; the model expands |
| `{{LENGTH}}` | 200 | Total characters; see table below |
| `{{TONE}}` | "温暖日常" | Prevents random tonal drift |
| `{{NEW_WORD_BUDGET}}` | 8 | Cap on new band words; tune per level (HSK1: 3, HSK2: 5, HSK3: 8, HSK5: 25) |
| `{{MIN_AT_LEVEL_WORDS}}` | 10 | Floor on distinct at-band words — see `MIN_AT_LEVEL_LEMMAS` in `src/lib/reading/grade.ts`: HSK1: n/a (exempt), HSK2: 5, HSK3: 10, HSK4: 12, HSK5+: 15 |
| `{{PREMISE}}` | "一个外国留学生第一次去中国邮局，服务员不会说英语" | More specific → more coherent. Include a constraint or tension. |
| `{{PROPER_NOUNS}}` | "北京, 长城, 小明" | Empty = no proper nouns allowed |
| `{{ALLOWED_VOCAB_NOTE}}` | "Refer to standard HSK 3.0 word list" | Or paste the list for strict compliance |

## Approved lengths by level

These are hard gates (`LENGTH_SPEC` in `src/lib/reading/grade.ts`) — a story
outside its band's range fails `verify-story.ts`, whether too short (most
common failure) or too long.

| HSK | Length (chars) | Read time |
|---|---|---|
| 1 | 80–200 | 3–6 min |
| 2 | 200–400 | 5–8 min |
| 3 | 400–800 | 8–15 min |
| 4 | 600–1000 | 10–18 min |
| 5 | 800–1200 | 14–22 min |
| 6 | 900–1400 | 16–25 min |
| 7 | 1000–1600 | 18–28 min |

## Model recommendations

- **HSK 1–3**: Use Qwen (strongest instruction follower, respects vocabulary constraints). Temperature 0.8–0.9 for variety.
- **HSK 4+**: DeepSeek (cheaper, good creative variety). Always include "Output in simplified Mandarin Chinese" explicitly.
- **Hybrid tip**: Qwen for strict-vocabulary HSK 1–3, DeepSeek for higher levels where creative variety matters more than compliance.

## The {{PREMISE}} trick

The premise's specificity is what forces the LLM away from generic textbook dialogs. Examples:

- HSK 1 coffee shop: "一个外国留学生第一次去学校旁边的咖啡店，服务员不会说英语"
- HSK 2 doctor: "一个学生发烧了，但是医院的医生只说中文"
- HSK 3 apartment: "一个外国人第一次在中国租房子，房东很严格"

Include a constraint or tension in the premise — it creates a real micro-story with stakes.

## Editing after generation

If a story fails `verify-story.ts` (too short, too few at-level words) and
you hand-edit the `.md` file to fix it rather than re-prompting Gemini, the
paired-line safety of the CN|||EN format is gone — you're now editing two
parallel lists by hand, and it's easy to desync them. This produced 4 real
bugs in the 2026-08-21 rewrite pass, caught only by a human/native read, not
by `verify-story.ts` (which only checks the Chinese side):

- Reordering or moving a Chinese paragraph without moving its matching
  `sentencesEn` entry the same distance — the two lists silently go out of
  sync (paragraph counts still matched, so nothing caught it mechanically).
- Extending a Chinese paragraph with a new clause (to add length or an
  at-level word) without extending the matching English line — the
  translation quietly drops content instead of being wrong.
- Reordering two scenes in the Chinese body without checking whether the
  new order still makes chronological sense (a "see you tomorrow" farewell
  ended up before an "afternoon coffee" scene it should have followed).
- Adding a new line of dialogue without wrapping it in `“ ”` and attributing
  a speaker, breaking the story's own established quoting convention.

Rule: when hand-editing a story after generation, treat the Chinese body and
`sentencesEn` as ONE edit, never two — move/extend/reorder both sides in the
same change, in the same order. After any structural edit (not just wording),
re-read the story start to finish (both languages) before re-running
`verify-story.ts`, since the script cannot see the English side or judge
chronology/dialogue consistency at all.

## After generating — your workflow

1. Copy the Gemini output (the CN|||EN lines)
2. Create the story file:
   ```bash
   npx tsx scripts/add-story.ts --level N --slug my-story \
     --title "标题" --title-en "Title" \
     --topic "话题" --topic-en "Topic"
   ```
3. Verify the story passes the HSK threshold:
   ```bash
   npx tsx scripts/verify-story.ts content/reading/hskN/my-story.md
   ```
4. Generate audio:
   ```bash
   python scripts/generate-story-audio.py
   ```
5. Ingest into the database:
   ```bash
   npx tsx scripts/ingest-story.ts content/reading/hskN/my-story.md --force
   ```
6. Human quality gate — `verify-story.ts` passing only proves the
   vocabulary/length numbers are in range; it cannot judge whether the story
   is actually good. A human still needs to read the story itself and check:
   does the plot make sense (no contradictions between title and events, no
   factual errors in cultural/historical content), is it more than flat
   我说/他说 dialogue with no narration or tension, and does the English
   read naturally rather than as a gloss? Read the flagged words too, but
   they're the smaller half of this review.
7. Mark `status: approved` in the .md frontmatter and re-ingest

## Quality gates (built into the pipeline)

- **verify-story.ts** flags any story where:
  - more than 5% of word tokens fall above the target HSK level (ceiling)
  - fewer than `MIN_AT_LEVEL_LEMMAS[level]` distinct words sit *at* the
    target band (floor — catches stories mislabeled too easy)
  - the character count falls outside `LENGTH_SPEC[level]` (floor and
    ceiling — catches stories that are too short, and ones padded too long)
- Stories with off-list proper nouns or too many at-level words with
  <3 repetitions get warnings (non-blocking)
- All stories must pass verification before being marked "published" — but
  passing verification is necessary, not sufficient; see the human gate above

## Tips

- Generate 3 variants per premise, pick the best one
- Vary {{TONE}} aggressively across stories (温暖日常, 悬疑, 幽默, 文化介绍)
- The premise's specificity is the #1 factor in output quality
- If a story fails verification, re-prompt with the offending words banned
- Your girlfriend reviews the flagged words — she's the human quality gate

---

*Adapted from ZAI/GLM graded-reader research (2026-08-18). Lengths and
vocabulary constraints based on DuChinese/HSKStory competitor benchmarks.*
