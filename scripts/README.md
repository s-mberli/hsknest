# scripts/

Everything here runs via `tsx` (or `npx tsx scripts/<name>.ts`). Most of
these check their own preconditions and print a dry-run summary before
writing anything — read a script's own header comment before running it
against a real database.

## Operational tooling

Scripts you might actually run again — at deploy time, from cron, or when
diagnosing a self-hosted instance.

- **`doctor.ts`** — self-service diagnostic ("why is there no audio", etc.),
  runnable via `npm run doctor` / `docker exec <container> npm run doctor`
  with no login or admin route needed.
- **`prune-guests.ts`** — deletes stale guest accounts (created long ago,
  never reviewed). Run at container boot; safe because guests are
  throwaway by design.
- **`backfill-sentence-pinyin.ts`** — idempotent: fills `Sentence.phonetic`
  on databases seeded before readings had pinyin. Only touches null rows.
- **`merge-duplicate-progress.ts`** — one-time-safe merge of duplicate
  `UserProgress` rows from before shared-progress-by-term existed; keeps
  the strongest row per user/term/language.
- **`check-declining-engagement.ts`**, **`send-trial-emails.ts`** — hosted-
  instance-only cron jobs (engagement nudge, trial lifecycle emails). Not
  applicable to self-hosted installs.

## Reading Mode content pipeline

The authoring loop for Reading Mode stories: an LLM proposes a story,
these scripts validate and land it.

- **`add-story.ts`** — create a story `.md` file from Gemini output or
  structured input.
- **`verify-story.ts`** — the quality gate: checks a story against its
  target HSK level before it's approved.
- **`ingest-story.ts`** — loads `status: approved` stories into the
  database (the human-review gate).
- **`reading-md.ts`** — shared frontmatter parser for the story `.md`
  format; imported by the scripts above, not run directly.

## HSK vocabulary data pipeline

Scripts that build or maintain the vendored HSK vocabulary
(`prisma/data/hsk/*.json`) from upstream sources.

- **`generate-hsk-data.ts`** — regenerates the vendored seed data from the
  upstream `complete-hsk-vocabulary` dataset (MIT licensed).
- **`generate-sentences.ts`** — builds `sentences.json` from a
  Tatoeba-derived zh↔en pair file (CC-BY 2.0 FR).
- **`add-sentence-pinyin.ts`** — fills `phonetic` on `sentences.json` using
  pinyin-pro; run once after regenerating sentences.
- **`sort-hsk-by-frequency.ts`** — sorts HSK word files by frequency rank
  so learners see common words first.
- **`migrate-hsk-levels.ts`** — migrates word lists from the 2021 draft
  HSK framework to the November 2025 official syllabus.
- **`compile-curated-glosses.ts`** — compiles curated glosses from the
  editorial journal plus a rule-based fallback.
- **`check-hsk-data-quality.ts`**, **`check-primary-sense-order.ts`**,
  **`check-sentence-quality.ts`** — automated consistency scans that flag
  suspicious rows for human/LLM review rather than fixing anything
  themselves.
- **`export-hsk-data.ts`**, **`export-for-gemini-review.ts`**,
  **`export-more-for-gemini.ts`** — export vocabulary/sentence samples
  (CSV or targeted JSON) for cross-checking against an external LLM.

## Historical data-curation one-offs

These already did their job during the HSK vocabulary audit (2026-08) and
are kept only as a record of what was changed and why — not part of any
ongoing workflow. Re-running one against current data may no-op or may
need adjustment; read its header comment first.

- **`fix-phonetics.ts`** — normalized mixed-style pinyin in the upstream
  seed JSONs.
- **`fix-primary-glosses.ts`** — promoted a sensible primary gloss where
  CC-CEDICT's first sense was a proper-noun/abbreviation/erhua pointer.
- **`fix-translation-cruft.ts`** — stripped CC-CEDICT metadata
  (classifier notes, abbreviation pointers, variant markers) from
  translations.
- **`fix-hsk-meanings.ts`** — in-place content refresh for seeded lists on
  an existing database, without the rename/delete a reseed would cause.
- **`shorten-particle-leads.ts`** — shortened grammar-particle leads (了,
  etc.) to textbook-style function labels.
- **`apply-pass2.ts`**, **`apply-unclear-final.ts`**,
  **`merge-audit-proposals.ts`**, **`final-sweep.ts`** — successive
  stages of the audit's correction pipeline: filling CEDICT placeholders,
  applying human-approved resolutions for the last unclear entries,
  merging audit proposals into the curated overrides, and a final sweep
  for empty fields/style/guard violations.

## `scripts/*.test.ts`

None currently — script logic that's worth covering lives in
`src/lib/__tests__/` instead, exercised through the same functions these
scripts call.
