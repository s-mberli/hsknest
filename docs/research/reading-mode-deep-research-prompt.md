# Reading Mode — Deep Research Prompt

> This prompt is for Gemini Deep Research. It does NOT have access to our codebase.
> After research, results will be fed back into the HSK Nest project for implementation planning.

---

## Context: What is HSK Nest?

HSK Nest (hsknest.com) is a spaced repetition vocabulary trainer for Chinese learners. Think Anki meets HackChinese, but better designed. It currently has:

- **SRS flashcards** with SM-2 algorithm (term → phonetic → meaning → grade)
- **6 practice modes**: SRS review, Quiz, Match, Sentences, Word Ninja (typing game), Pronunciation
- **11,000+ HSK vocabulary words** across levels 1-9
- **Example sentences** for many words (with pinyin + translation)
- **Word lists** (textbooks, HSK official, frequency-based)
- **Audio pronunciation** via Web Speech API (TTS) with Chinese voices
- **Multi-language ready** schema (not hardcoded to Chinese, but Chinese is the primary language)
- **Subscription model** (freemium — free tier with limits, paid for full access)

**Tech stack**: Next.js App Router, TypeScript, Prisma/SQLite, Tailwind CSS, shadcn/ui, framer-motion, deployed on Docker (VPS).

**License model**: The app is proprietary (not open source). Text content must be legally usable — no pirated books, no copyrighted material without permission.

---

## What We Want to Build: "Reading Mode"

A new tab/mode where users **read Chinese texts** at their HSK level, with:

1. **Graded texts** organized by HSK level (1-9) and topic
2. **Read-aloud audio** — the entire text narrated by a natural Chinese voice
3. **Hover/tap to understand** — tap any word to see pinyin, meaning, and HSK level
4. **Sentence-level highlighting** — as audio plays, the current sentence highlights (karaoke-style)
5. **Comprehension support** — vocabulary from the text ties back into the SRS system

Think: **DuChinese** (graded reader app) meets **PlusOneLanguage** (hover-to-read web app) meets **LingQ** (reading + SRS integration).

---

## Research Questions

### 1. Comparable Products — What Makes a Good Reading Experience?

Research these products in depth. What features do they have? What do learners love or hate? What's the "secret sauce"?

- **DuChinese** (app + web) — the gold standard for graded Chinese readers
- **PlusOneLanguage** (web) — hover-to-read Chinese texts
- **LingQ** — reading + SRS integration for multiple languages
- **The Chairman's Bao** — news-based graded Chinese reader
- **Decipher Chinese** — graded reading app
- **Chinese Reading Practice** (various web tools)
- **Pleco Reader** — built into the Pleco dictionary app
- **Maayot** — Chinese graded reader app
- **HiNative** — community-driven reading + Q&A
- **Beelinguapp** — parallel text reading

For each, analyze:
- How are texts organized? (by level, topic, length, genre?)
- How does audio work? (TTS vs. human narration? Sentence-by-sentence or full text?)
- How does the hover/tap dictionary work? (popup? inline? sidebar?)
- How does vocabulary tracking work? (known/unknown words? SRS integration?)
- How does comprehension checking work? (quizzes? questions? summaries?)
- What's the visual design like? (clean? cluttered? reading-optimized?)
- What's the pricing model? (free? freemium? subscription?)
- What are the most common user complaints? (Reddit, App Store reviews, forums)

### 2. Text Sources — Where to Get Chinese Reading Material

This is critical. We need texts that are:
- **Legally usable** (public domain, Creative Commons, or licensed)
- **Quality Chinese** (proper grammar, natural language, not machine-translated)
- **Gradable** (can be sorted by difficulty/HSK level)
- **Interesting** (not boring textbook dialogs about going to the post office)

Research these categories:

#### A. Public Domain / Open Source Chinese Texts
- **Chinese classical literature** (四大名著, 唐诗宋词, etc.) — which are public domain? Are simplified Chinese versions available?
- **Project Gutenberg Chinese** — what's available?
- **Wikisource Chinese** — quality? Licensing?
- **Chinese government open data** — any educational text datasets?
- **Internet Archive Chinese texts** — what's there?

#### B. Creative Commons / Open Educational Resources
- **Chinese graded reader projects** (open source) — any existing ones?
- **HSK reading materials** with open licenses
- **University Chinese programs** that publish reading materials openly
- **Confucius Institute** materials — are any openly licensed?
- **Chinese language learning communities** that share texts

#### C. Licensed / Curated Sources
- **Chinese news sites** with API access or licensing programs
- **Chinese children's books** — licensing for educational apps
- **Chinese literature in translation** — parallel text licensing
- **Existing graded reader publishers** — would they license to an app?

#### D. Community-Generated Content
- **User-submitted texts** — legal considerations, quality control
- **Wikipedia Chinese** — licensing (CC BY-SA), quality for learning?
- **Chinese blogs and forums** — can excerpts be used? Fair use?

#### E. Datasets for NLP / Difficulty Analysis
- **Chinese text difficulty datasets** — any academic research?
- **HSK vocabulary frequency lists** — for auto-grading text difficulty
- **Chinese corpus datasets** — for building a difficulty classifier
- **Pinyin annotation tools** — open source libraries for auto-adding pinyin

For each source, report:
- **License**: What can we legally do with it? (use, modify, distribute, commercial use?)
- **Quality**: Is it natural, well-written Chinese? Or machine-generated / low quality?
- **Volume**: How much content is available? Enough for a reading app?
- **Difficulty range**: Can we find texts at all HSK levels (1-9)?
- **Format**: What format is it in? (plain text, HTML, XML, PDF? Does it have pinyin? Metadata?)
- **Effort**: How much work to integrate? (cleaning, grading, formatting?)

### 3. Audio — How to Read Texts Aloud

Research Chinese TTS (Text-to-Speech) options for reading texts aloud:

#### A. Web Speech API (what we currently use)
- Quality of Chinese voices across browsers (Chrome, Safari, Firefox, Edge)
- Can it do sentence-by-sentence highlighting? (word boundary events?)
- Limitations for long text reading

#### B. Cloud TTS Services
- **Google Cloud TTS** — Chinese voices, quality, pricing, word boundary/timing data
- **Amazon Polly** — Chinese voices, quality, pricing
- **Microsoft Azure TTS** — Chinese voices, neural voices, pricing
- **ElevenLabs** — Chinese support? Quality? Pricing?
- **OpenAI TTS** — Chinese support? Quality? Pricing?
- **Baidu TTS** — Chinese-native, quality, pricing
- **iFlytek TTS** — Chinese-native, quality, pricing

For each, report:
- **Voice quality**: How natural does it sound? (human-like? robotic?)
- **Chinese support**: Mandarin? Multiple voices (male/female)? Regional accents?
- **Word boundary data**: Can we get timing information for each word/sentence? (needed for karaoke-style highlighting)
- **SSML support**: Can we control speed, pitch, pauses? (useful for slow/fast reading modes)
- **Pricing**: Free tier? Per-character cost? At scale (1000 texts × 1000 characters = 1M characters)?
- **Latency**: How fast does audio generate? Can we pre-generate and cache?
- **Licensing**: Can we cache/store generated audio? Or must it be generated on-demand?

#### C. Pre-recorded Audio
- Are there open datasets of Chinese text being read aloud?
- Could we use human narration for some texts? (podcasts, audiobooks, educational recordings)
- Legal considerations for using audio from existing sources

### 4. Hover/Tap Dictionary — How to Define Words on Touch

Research how to implement an in-text dictionary popup:

#### A. Existing Libraries
- **pinyin-pro** or **pinyinjs** — auto-annotate text with pinyin
- **chinese-conv** — simplified/traditional conversion
- **CEDICT** (Chinese-English dictionary) — open source, comprehensive, HSK-tagged?
- **CC-CEDICT** — community-maintained CEDICT fork
- **Pleco's dictionary data** — any API or licensing?
- **MDBG** — online CEDICT-based dictionary, API?
- **Hanping** — dictionary data licensing

#### B. Implementation Approaches
- **Client-side dictionary**: Bundle CEDICT (~1MB compressed) and look up words in the browser
- **Server-side dictionary**: API call on hover/tap (latency concern)
- **Hybrid**: Bundle common words (HSK 1-6), API call for rare words (HSK 7-9)
- **Segmentation**: How to segment Chinese text into words? (Chinese has no spaces!)
  - **jieba** — popular Chinese segmentation library (Python, but Node.js ports exist)
  - **segmentit** — JavaScript Chinese segmentation
  - **Intl.Segmenter** — browser-native segmentation (ECMAScript)
  - **chinese-segmentation** — various npm packages

#### C. Word Identification Challenges
- How to handle: 了 (multiple meanings/parts of speech), 得/地/的 (homophones), 成语 (4-char idioms), 专有名词 (proper nouns)
- How to handle words that span multiple characters but aren't in the dictionary as a unit
- How to handle context-dependent meanings (e.g., 打 has 20+ meanings)

### 5. Integration with SRS — How Reading Connects to Memorization

Research how reading apps integrate with spaced repetition:

#### A. Vocabulary Tracking
- How to track which words the user "knows" from reading vs. from flashcards
- Should reading a word count as a "review" for SRS purposes?
- How to handle: words the user has seen in reading but never studied formally
- Vocabulary states: Unknown → Encountered → Learning → Known → Mastered

#### B. Reading-Specific SRS
- Should there be a separate SRS for reading? (e.g., "I read this word in context 3 days ago, do I still remember it?")
- How does LingQ track vocabulary from reading?
- How does DuChinese track reading progress?

#### C. Adding Words from Reading to SRS
- "Add to my vocabulary" button on hover popup
- Auto-add words that the user looked up multiple times
- Batch-add all unknown words from a text
- How to handle the intersection: words already in the user's SRS deck vs. new words from reading

#### D. Difficulty Calibration
- How to calculate text difficulty based on the user's known vocabulary
- "This text is 85% within your vocabulary" — how to compute this
- Adaptive difficulty: suggest texts that are slightly above the user's level (i+1 hypothesis)

### 6. Visual Design — What Does a Great Reading Interface Look Like?

Research reading UI best practices:

#### A. Typography for Chinese Text
- Optimal font size for Chinese characters (on mobile and desktop)
- Line height and character spacing for readability
- Best Chinese web fonts (Noto Sans SC? Source Han Sans? LXGW WenKai?)
- How to handle mixed Chinese/English text (e.g., names, technical terms)
- Dark mode considerations for reading

#### B. Layout Patterns
- Full-width text vs. constrained column width (optimal line length for Chinese)
- Sentence-by-sentence display vs. paragraph flow
- How to display pinyin above characters (ruby text / annotation)
- Sidebar vocabulary panel vs. inline popup
- Mobile reading layout (thumb zone, font size, scrolling)

#### C. Reading Flow
- How to handle long texts (scrolling vs. pagination)
- Progress indicators (how far through the text)
- Bookmarking / saving progress
- Font size adjustment controls
- Night mode / reading mode (warm colors, reduced brightness)

#### D. Comprehension Aids
- Word frequency highlighting (show which words are important)
- Grammar point annotations
- Cultural context notes
- Summary / key takeaways at the end
- Comprehension questions (multiple choice, free response)

### 7. Implementation Architecture — How to Build This

Research technical implementation:

#### A. Data Model
- How to store texts in the database (Prisma/SQLite schema)
- How to store word-level annotations (pinyin, meaning, HSK level per word)
- How to store audio (pre-generated vs. on-demand)
- How to track reading progress per user per text

#### B. Text Processing Pipeline
- How to auto-grade text difficulty (HSK level estimation)
- How to auto-annotate with pinyin
- How to auto-segment into words
- How to generate audio with word-level timing data
- How to handle errors in auto-annotation (human review workflow?)

#### C. Performance
- How to load long texts without slow page loads
- How to handle audio streaming / preloading
- How to make hover dictionary feel instant (no lag)
- How to handle offline reading (PWA? Service worker?)

#### D. Content Management
- Admin interface for adding/editing texts
- Review workflow for user-submitted texts
- Version control for text corrections
- Analytics: which texts are popular, which have errors

### 8. Learning Science — What Makes Reading Effective for Language Acquisition?

Research the pedagogy:

#### A. Extensive Reading vs. Intensive Reading
- What's the research say about reading for language learning?
- Optimal text difficulty for learning (i+1 hypothesis, 98% comprehension threshold)
- How much reading is needed to make progress?
- How does reading complement SRS flashcards?

#### B. Graded Reader Theory
- What makes a good graded reader? (Paul Nation's research, etc.)
- How many words should be "unknown" in a text for it to be useful?
- Should unknown words be glossed inline or in a separate section?
- How to balance: interesting content vs. appropriate difficulty

#### C. Reading + Listening Combined
- Research on dual-modality input (reading + listening simultaneously)
- Does karaoke-style highlighting help acquisition?
- Optimal reading speed for learning (slow? natural? adjustable?)

#### D. Vocabulary Acquisition from Context
- How many exposures does it take to learn a word from context?
- How does reading contribute to vocabulary acquisition vs. explicit study?
- Should the app track "exposures" from reading as part of SRS?

---

## Deliverable Format

For each research area, provide:

1. **Executive Summary** (2-3 sentences)
2. **Key Findings** (bullet points)
3. **Recommendations** (what we should do, with reasoning)
4. **Sources** (links to papers, products, datasets, tools)
5. **Open Questions** (things we still need to decide)

End with a **Prioritized Implementation Roadmap** — what to build first, what can wait, what's a stretch goal.

---

## Constraints to Keep in Mind

- **License**: All text content must be legally usable (public domain, CC, or licensed). No piracy.
- **Budget**: We're a small team. Prefer free/open-source tools. Cloud TTS costs matter at scale.
- **Tech stack**: Next.js, TypeScript, Prisma/SQLite, Tailwind. Must integrate with existing codebase.
- **Mobile-first**: Most users will read on phones. Design for that.
- **Chinese-first**: This feature is for Chinese learners. Optimize for Chinese text display, pinyin, character recognition. Other languages can come later.
- **Existing SRS**: Must integrate with the existing SM-2 spaced repetition system. Don't replace it — extend it.
- **Existing audio**: We already use Web Speech API for flashcard pronunciation. Can we reuse it for reading? Or do we need better quality?

---

*Prompt written: 2026-08-18*
*Target: Gemini Deep Research*
*Project: HSK Nest (hsknest.com)*
