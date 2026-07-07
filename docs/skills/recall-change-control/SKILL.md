---
name: recall-change-control
description: >-
  Change classification, gating, and review rules for the Recall SRS app. Load
  this skill BEFORE making any change to this repo — especially before editing
  the Prisma schema or migrations, anything in src/lib/srs/*, the study
  queue/cap logic, API routes, or UI components. Also load it when asked "can I
  change X?", "is this migration safe?", "what tests must pass before merge?",
  "what are the project's non-negotiables?", or when reviewing a diff/PR for
  this project. Covers migration safety, scheduler proof requirements, the UI
  polish bar, validation requirements, and license constraints. Pairs with
  recall-architecture-contract for invariants.
---

# Recall change control

How changes to Recall are classified, gated, and reviewed. Recall is a
self-hostable spaced-repetition (SRS — "spaced repetition system", software
that schedules flashcard reviews at growing intervals) vocabulary trainer:
Next.js App Router + TypeScript, Prisma ORM + SQLite, NextAuth credentials
auth, Tailwind + shadcn-style UI, framer-motion, Vitest unit tests, Playwright
E2E, Docker/Coolify deploy. Repo root: the project root containing
`CLAUDE.md`, `docs/`, `prisma/`, `src/`.

Facts below verified against the repo on **2026-07-07**. See "Provenance and
maintenance" at the end for re-verification commands.

## The three non-negotiables (with rationale)

### 1. NEVER break existing user data

Self-hosters run this in production with a single SQLite file on a Docker
volume. There is no support team and no undo. Therefore:

- **Migrations must be additive / backward-safe.** New nullable columns, new
  tables, new indexes: fine. Dropping or renaming columns, tightening
  constraints on populated tables: requires an explicit multi-step plan and a
  backup note in the PR.
- Migration flow (verified in repo):
  - Local dev: `npm run db:migrate` (runs `prisma migrate dev`).
  - Production: the container entrypoint `docker-entrypoint.sh` runs
    `prisma migrate deploy` on every boot, then seeds starter content **once**,
    guarded by the `/data/.seeded` marker file on the data volume. Your
    migration will be applied unattended to live databases — write it as if
    nobody is watching, because nobody is.
- **Seeded content is read-only.** Seeded/global rows have
  `createdById = null`. The single visibility/ownership rule lives in
  `src/lib/ownership.ts` (`visibleListWhere`, `visibleLanguageWhere`);
  mutations require `createdById` to equal the caller. Never add a write path
  that can touch seeded rows.
- **`UserProgress` stores an algorithm superset.** It holds fields for every
  supported algorithm (SM-2's `easeFactor`/`repetitions`/`intervalDays` AND
  Leitner's `box`, plus `lapses`, `dueAt`, and an open `srsData` JSON escape
  hatch — see `SRSState` in `src/lib/srs/types.ts`). Rationale: a user can
  switch `preferredAlgorithm` at any time and switch back with zero data loss.
  Never make a field algorithm-exclusive or drop a field "the current
  algorithm doesn't use".

### 2. Scheduler changes need PROOF

The scheduler is the product. A subtle bug (interval drift, cap
double-spending) silently destroys months of a user's study plan. Therefore
any change to `src/lib/srs/*` (currently `index.ts`, `sm2.ts`, `leitner.ts`,
`modifiers.ts`, `types.ts`) or to the queue/cap logic (`/api/study/queue`
route, `src/lib/studyScope.ts`, `src/lib/postReview.ts`) must, before merge:

1. Be **justified against the algorithm spec** — cite the SM-2 / Leitner rule
   you are implementing or intentionally deviating from (see the
   `srs-theory-reference` sibling skill and `docs/ARCHITECTURE.md`).
2. Be **covered by unit tests** in `src/lib/srs/__tests__/` (existing:
   `sm2.test.ts`, `leitner.test.ts`, `modifiers.test.ts`).
3. Pass `npm test` (Vitest) and `npm run build`.

Algorithm functions must stay **pure** — `calculateNextReview(state, quality,
now)` returns a new state and never mutates its input (contract in
`src/lib/srs/types.ts`).

### 3. UI polish bar

The pitch is "inspired by HackChinese but better" — a generic-looking UI
kills the project's reason to exist. Per `CLAUDE.md` section 4:

- Mobile-first, responsive; gesture-first (flashcards swipe via framer-motion
  — left/down/right/up = quality 1/3/4/5; canonical mapping:
  `srs-theory-reference` §3).
- Minimalist, clean whitespace. No generic default-looking shadcn components
  shipped unstyled.
- **No purple gradients.** Ever.

## Change classification and gates

Classify every change by the highest-risk class it touches (schema >
scheduler > API > UI > docs) and apply that class's gates **plus** all gates
of lower classes it also touches.

| Class | Touches | Gates before merge |
|---|---|---|
| 1. Schema | `prisma/schema.prisma`, `prisma/migrations/` | Migration review (additive/backward-safe? runs cleanly via `migrate deploy` on an old DB?); backup note in PR; `npm run db:migrate` locally; seed idempotency unaffected |
| 2. Scheduler | `src/lib/srs/*`, queue/cap logic (`studyScope.ts`, `postReview.ts`, `/api/study/queue`) | Spec justification written down; unit tests in `src/lib/srs/__tests__`; `npm test` green |
| 3. API | `src/app/api/**` | Every new/changed input parsed with a Zod schema in `src/lib/validation.ts` (never inline, never unvalidated `req.json()`); ownership checks via `src/lib/ownership.ts` on reads and writes |
| 4. UI | `src/app/**` (pages), `src/components/**` | Polish bar (non-negotiable 3); E2E in `e2e/` (currently `e2e/journey.spec.ts`) updated when a user journey changes; `npm run test:e2e` |
| 5. Docs | `README.md`, `docs/*`, `CLAUDE.md` | Accuracy check against code; no gates beyond review |

**Every class**: `npm run build` must pass. Copy-pasteable command set
(cross-platform, works on the Windows dev machine):

```
npm test           # Vitest unit tests (vitest run)
npm run build      # next build
npm run test:e2e   # Playwright (needs a dev DB; see recall-validation-and-qa)
npm run db:migrate # prisma migrate dev (local schema changes)
```

## Pre-merge checklist

- [ ] Change classified (schema / scheduler / API / UI / docs); highest class's gates applied
- [ ] No migration drops/renames columns or tightens constraints without a written multi-step plan and backup note
- [ ] Seeded content (`createdById = null`) still read-only; ownership helpers from `src/lib/ownership.ts` used, not re-implemented
- [ ] No `UserProgress` field removed or made algorithm-exclusive
- [ ] Scheduler changes: spec citation + unit tests in `src/lib/srs/__tests__`
- [ ] New API inputs validated via Zod schemas in `src/lib/validation.ts`
- [ ] User-journey changes reflected in `e2e/journey.spec.ts`
- [ ] `npm test` and `npm run build` green
- [ ] UI: mobile-first, no generic default components, no purple gradients
- [ ] CLAUDE.md rules held: schema stays language-agnostic (`term`, `translation`, `phonetic`, `metadata` JSON — never hardcode `pinyin`); SM-2 lives in `src/lib/srs` (as `sm2.ts`)
- [ ] License respected (below)

## License constraints

- The app is **AGPL-3.0** (see `LICENSE`). Any code you vendor in must be
  AGPL-compatible; changes to a hosted instance must remain source-available.
- The bundled HSK vocabulary (`prisma/data/hsk/hsk1.json` … `hsk6.json`) is
  derived from the MIT-licensed `complete-hsk-vocabulary` dataset — attribution
  and details in `prisma/data/hsk/README.md`. Keep that README and its
  attribution intact if you touch the data.

## When NOT to use this skill

Use the sibling skill instead when the question is about:

- **What the system looks like / data model / request flow** → `recall-architecture-contract`
- **Why SM-2/Leitner work the way they do (algorithm theory)** → `srs-theory-reference`
- **Installing deps, env vars, building the app** → `recall-build-and-env`
- **Running, deploying, operating (Docker/Coolify)** → `recall-run-and-operate`
- **User settings / configuration knobs** → `recall-config-and-settings`
- **Diagnosing a live bug** → `recall-debugging-playbook` and `recall-diagnostics-toolkit`
- **How to run/write tests in detail** → `recall-validation-and-qa`
- **Writing docs or user-facing copy** → `recall-docs-and-writing`
- **The FSRS migration effort** → `recall-fsrs-campaign`
- **Open research questions** → `recall-research-program`

This skill is only for deciding *whether and how a change is allowed in*, not
how to implement it.

## Provenance and maintenance

Verified 2026-07-07 against the working tree (branch `main`, commit
`e8f06ed`). Re-verify volatile facts with:

- Scripts and commands: `npm run` (or read `package.json` `scripts`)
- Entrypoint migrate/seed behavior: read `docker-entrypoint.sh` (look for `migrate deploy` and `/data/.seeded`)
- Ownership rule: read `src/lib/ownership.ts`
- SRS module inventory: `ls src/lib/srs src/lib/srs/__tests__`
- Validation schemas: read `src/lib/validation.ts`
- Queue/cap description: `docs/ARCHITECTURE.md` ("Queue & cap logic" section)
- License: `head -5 LICENSE`; HSK data license: `prisma/data/hsk/README.md`
- Project rules: `CLAUDE.md`
