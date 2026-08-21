# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Serious Mandarin learners studying the New HSK 3.0 curriculum (levels 1–9), plus
general language learners adding their own vocabulary in any language. Two
deployment audiences share one codebase: self-hosters running the AGPL app on
their own VPS, and subscribers of the managed hsknest.com cloud version
(14-day trial, €10/month). Learners use it daily for short study sessions and
expect distraction-free, gesture-first tooling.

## Product Purpose

HSK Nest is a self-hostable flashcard trainer that schedules vocabulary reviews
with FSRS (SM-2 and Leitner also available) at the moment of predicted
forgetting. It ships Mandarin-first: complete New HSK 3.0 vocabulary, 3,000
example sentences with pinyin, natural Azure neural TTS audio served from the
user's own server, dictionary-assisted entry, and CSV/paste import. Success =
users retain vocabulary long-term, own their data, and keep a daily habit.

## Positioning

The same modern memory model as Anki (FSRS) in a focused, Mandarin-first,
mobile-first web app — self-hostable under AGPL with no subscriptions, no
telemetry, no lock-in. Neighboring products are either closed-cloud (HackChinese,
DuChinese), general-purpose desktop tools (Anki), or per-language apps without
modern scheduling.

## Operating Context

- Daily short study sessions on mobile (swipe deck, dark focus mode) and desktop.
- Self-hosting via Docker Compose on a VPS; SQLite single-file database with
  nightly backups; audio pre-generated offline (edge-tts) and served as static
  files from a Docker volume.
- Managed cloud version with Stripe billing; identical feature surface.
- Content pipeline: seed data in `prisma/data/` (HSK JSON, sentences, CC-CEDICT
  trim), stories authored as markdown files in `content/reading/` and ingested
  via offline scripts.

## Capabilities and Constraints

- Pluggable scheduling: FSRS / SM-2 / Leitner, per-user choice; scheduler
  correctness is the project's most protected asset.
- Language-agnostic core (`Language`, `WordList`, `Word` with `term`,
  `translation`, `phonetic`, `metadata`); Mandarin extras live in data and
  helpers, never hardcoded schema fields.
- Auth: NextAuth credentials + JWT; every user-visible route authenticated
  except marketing/legal pages.
- Validation: Zod on all API routes.
- Reading Mode: HSK 1–5 graded stories with karaoke audio, adaptive pinyin,
  zero-latency tap dictionary, per-word/batch add-to-deck, and comprehensible-
  input matching (coverage badges + a "best next read" recommendation).
  Reading activity counts toward streak/heatmap but never toward recallRate
  or a review — that boundary is deliberate (see Product Principle 2).
- Constraint: additive-only schema changes; no telemetry; AGPL-3.0 code.

## Brand Commitments

- Name: HSK Nest. Voice: precise, learner-respecting, no dark patterns.
- No subscriptions on self-host; hosted tier priced simply.
- Open-source credits shown in-app at `/credits` (Tatoeba, CC-CEDICT, HSK lists).
- No fabricated claims in docs or marketing (see docs-of-record discipline).

## Evidence on Hand

- Screenshots of dashboard, study deck, word browser, list editor in `docs/screenshots/`.
- Live product: hsknest.com; CI + Docker image on GitHub.
- Data assets: `prisma/data/hsk/` (HSK 3.0 JSON levels 1–7, frequency lists,
  sentences), `prisma/data/cedict/cedict.json.gz` (trimmed CC-CEDICT).
- Research: `docs/research/reading_mode_result.txt` (competitor + technical
  deep research for Reading Mode).

## Product Principles

1. Own your data: export, self-host, no lock-in — every feature must run
   self-hosted with zero external service dependencies at runtime.
2. Scheduler integrity: reading, quizzes, and games may log and nudge but never
   fabricate SRS reviews; the scheduler's inputs stay honest.
3. Mandarin-first, language-agnostic core: HSK-specific richness layered on a
   generic data model.
4. Focus over features: one primary action per screen; polish beats breadth.
5. Pre-compute, then serve statically: audio, annotations, and difficulty data
   are generated offline — the runtime does lookup, never synthesis.

## Accessibility & Inclusion

Mobile-first responsive design; light/dark/system themes plus dark study focus
mode; keyboard fallbacks for gesture interactions; `cardTextSize` setting for
text scale. No formal standard compliance claimed yet.
