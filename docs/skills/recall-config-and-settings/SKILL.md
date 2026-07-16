---
name: recall-config-and-settings
description: Catalog of every configuration axis in HSK Nest — environment variables (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL), per-account user settings (preferredAlgorithm, theme, studyTheme, cardTextSize, dailyNewWords, assumedCheckPerDay, intervalModifier, lapseModifier, masteryThresholdDays, fuzzIntervals), session-scope choices, valid ranges and defaults, tuning knobs, and the step-by-step checklist for ADDING a new setting (schema → Zod → API → UI → consumer → tests). Use when configuring the app, changing a default, tuning SRS behavior, or wiring a new setting end-to-end.
---

# HSK Nest: Configuration & Settings Catalog

Ground truth verified against the code on **2026-07-07**. When in doubt, the code wins over docs — re-verify with the commands at the bottom.

Three layers of configuration, from most to least global:

1. **Environment variables** — per-deployment, in `.env`.
2. **Per-account settings** — columns on the `User` model, edited on the Settings page via `PATCH /api/settings`.
3. **Session-scope choices** — per-device study preferences, persisted in browser `localStorage`, never on the server.

## When NOT to use this skill

- Changing schema/migrations or asking "is this change safe?" → `recall-change-control`
- Build, install, Docker, deployment env plumbing → `recall-build-and-env`; running/operating the app → `recall-run-and-operate`
- How SM-2/Leitner math works → `srs-theory-reference`; FSRS work → `recall-fsrs-campaign`
- System layering/data flow → `recall-architecture-contract`
- Debugging a broken behavior → `recall-debugging-playbook`; health checks → `recall-diagnostics-toolkit`
- Tests/QA process → `recall-validation-and-qa`; docs writing → `recall-docs-and-writing`; research → `recall-research-program`

## 1. Environment variables

Source of truth: `.env.example` (repo root) and `docs/CONFIGURATION.md`. Only three variables exist (as of 2026-07-07).

| Variable | Required | Dev value | Prod value | What breaks when wrong |
|---|---|---|---|---|
| `DATABASE_URL` | yes | `file:./dev.db` (SQLite) | `file:/data/recall.db` — production is **SQLite on the persistent `/data` volume** (Dockerfile, docker-compose.yml; deploy applies migrations via `prisma migrate deploy`, never `migrate dev`). Postgres is a documented-but-unexercised future path that must go through `recall-change-control`. Deployment reality lives in `recall-run-and-operate`. | Prisma client fails to connect: every API route and page 500s. Wrong file path silently creates an empty new DB (looks like data loss). |
| `NEXTAUTH_SECRET` | yes | any long random string | `openssl rand -base64 32` output; stable across restarts | JWT session tokens can't be verified/signed → login fails or all users logged out on every rotation. |
| `NEXTAUTH_URL` | yes\* | `http://localhost:3000` | canonical public base URL (https) | Redirects/callbacks after sign-in go to the wrong host; auth loops behind reverse proxies. \*Optional in some local setups, recommended everywhere (per `docs/CONFIGURATION.md`). |

Set in `.env` at repo root; never commit the real `.env`.

## 2. Per-account settings (User model = source of truth)

Storage: columns on `model User` in `prisma/schema.prisma`. Validation: `settingsSchema` in `src/lib/validation.ts`. API: `src/app/api/settings/route.ts` (GET returns all, PATCH accepts partial). UI: `src/components/settings/SettingsForm.tsx` (rendered by `src/app/(app)/settings/page.tsx`).

| Field | Type / default (schema.prisma) | Valid values (Zod, validation.ts) | Controls | Read in code | Status |
|---|---|---|---|---|---|
| `preferredAlgorithm` | enum `SRSAlgorithmType` = `SM2` | `"SM2" \| "LEITNER"` | Which scheduler processes reviews; progress carries over on switch | `src/app/api/study/review/route.ts` | production-safe |
| `name` | `String?`, no default | trimmed string, min 1 | Display name | settings API/UI only | production-safe |
| `theme` | `String @default("system")` | `"light" \| "dark" \| "system"` | App-wide theme; applied instantly via next-themes (localStorage) and written through to the account | `src/components/ThemeSync.tsx` (hydrates account theme on mount) | production-safe |
| `studyTheme` | `String @default("follow")` | `"dark" \| "follow"` | Study screen: forced dark focus mode vs. follow app theme; read server-side by the study page to avoid first-paint flash | `src/app/(app)/study/page.tsx`, `StudyScreen.tsx`, quiz/match pages | production-safe. **Doc mismatch — see below.** |
| `cardTextSize` | `String @default("normal")` | `"small" \| "normal" \| "large"` | Study-card text scale (term/phonetic/translation Tailwind classes) | `src/lib/textSize.ts` (`CARD_TEXT_CLASSES`, `normalizeCardTextSize`), consumed by `StudyScreen.tsx`, `QuizScreen.tsx`, `MatchScreen.tsx` | production-safe |
| `dailyNewWords` | `Int @default(10)` | int 0–200 | New cards introduced per day; `0` pauses new learning (reviews only) | `src/app/api/study/queue/route.ts` (daily new-word cap via `UserProgress.introducedAt`) | production-safe |
| `assumedCheckPerDay` | `Int @default(3)` | int 0–50 | ASSUMED (marked-known) words re-checked per day | `src/app/api/study/queue/route.ts` (via `assumedCheckedAt`) | production-safe |
| `intervalModifier` | `Float @default(1.0)` | 0.5–3 | Multiplies interval after a success (quality ≥ 3) | `src/lib/srs/modifiers.ts` (`applyUserModifiers`) | tuning knob, production-safe |
| `lapseModifier` | `Float @default(0.0)` | 0–1 | Post-lapse interval = `max(1, prevInterval * lapseModifier)`; `0` = full reset (modifier skipped entirely when 0) | `src/lib/srs/modifiers.ts` | tuning knob, production-safe |
| `masteryThresholdDays` | `Int?` (default **null** = never retire) | int 1–3650, nullable | Interval ≥ threshold → state `MASTERED`, stop scheduling | `src/lib/srs/modifiers.ts` | tuning knob, production-safe |
| `fuzzIntervals` | `Boolean @default(true)` | boolean | ±5% interval randomization (only applied when interval ≥ 2 days) | `src/lib/srs/modifiers.ts` | production-safe |
| `settings` | `Json?` | — not in Zod schema, not writable via API | Reserved (candidate store for per-user fitted FSRS weights — see `recall-fsrs-campaign`; reserved-column ownership is documented in `recall-architecture-contract`) | nowhere yet | reserved |

All PATCH fields are optional (partial update). Tests for the tuning knobs: `src/lib/srs/__tests__/modifiers.test.ts`. Canonical modifier semantics live in `srs-theory-reference` §6 — the summaries above are for catalog purposes only.

### Doc-vs-code mismatches found (2026-07-07)

1. **`studyTheme` default**: `docs/CONFIGURATION.md` says "stored in `User.studyTheme` (default `dark`)" but `prisma/schema.prisma` line 32 says `@default("follow")`. Code wins: the default is **`follow`**.

Migrations ARE committed: `prisma/migrations/` contains 8 migration directories (each with `migration.sql`), `20260705111552_init` through `20260706153715_phase11_card_text_size`, plus `migration_lock.toml`. Migrations are mandatory for schema changes — `prisma migrate dev` creates one locally; production applies them via `prisma migrate deploy`. Migration-inventory facts live in `recall-build-and-env`.

## 3. Session-scope choices (client-side, per device)

These never touch the database. Persisted in browser `localStorage`, encoded into the `/study` URL as query params, consumed server-side by the queue API.

| Choice | Values | Persisted where | Consumed by |
|---|---|---|---|
| Session size by cards | 10 / 20 / 50 / All (All = limit 500, `ALL_LIMIT` in `SessionPicker.tsx`) | `localStorage["study-session-choice"]` | `/study?limit=N` → `src/app/api/study/queue/route.ts` |
| Session size by minutes | 2 / 5 / 10 min; cards = minutes × `CARDS_PER_MINUTE` (= 5, `src/lib/studyScope.ts`) | same localStorage blob | `/study?minutes=N` |
| Study scope: language | one `languageId` | same blob (via `ScopePicker.tsx`) | `/study?languageId=...` |
| Study scope: lists | `listIds` (comma-joined) | same blob | `/study?listIds=a,b` |
| Theme (instant path) | light/dark/system | next-themes localStorage; reconciled with `User.theme` by `ThemeSync.tsx` | app layout |

Key files: `src/components/dashboard/SessionPicker.tsx` (restore/persist logic, `buildHref`), `src/components/dashboard/ScopePicker.tsx`, `src/lib/studyScope.ts`.

## 4. How to ADD a new per-account setting

Checklist derived from how existing settings flow. Worked example in parentheses: `cardTextSize`.

1. **Schema** — add the column with an explicit default to `model User` in `prisma/schema.prisma` (e.g. `cardTextSize String @default("normal")` with a comment listing valid values). Then create/apply a migration: `npm run db:migrate` (= `prisma migrate dev`) and **commit the generated migration directory** — see `recall-change-control` before altering the schema. `npx prisma generate` refreshes the client types.
2. **Validation** — add the field to `settingsSchema` in `src/lib/validation.ts`, always `.optional()` since PATCH is partial (e.g. `cardTextSize: z.enum(["small", "normal", "large"]).optional()`). Give it explicit bounds/enum — never a bare `z.string()`.
3. **API** — add the field to BOTH `select` blocks (GET and PATCH) in `src/app/api/settings/route.ts`. The PATCH body is already `parsed.data`, so no other write change needed.
4. **Shared helper (if the value maps to behavior)** — put the mapping and a `normalize*` fallback in `src/lib/` (e.g. `src/lib/textSize.ts` exports `CardTextSize`, `CARD_TEXT_CLASSES`, `normalizeCardTextSize` which coerces junk to `"normal"`).
5. **Settings UI** — add the control to `src/components/settings/SettingsForm.tsx` and make sure the server component `src/app/(app)/settings/page.tsx` selects and passes the field.
6. **Consumer** — read the field where it takes effect. Server components read it via Prisma select (e.g. `src/app/(app)/study/page.tsx` passes `cardTextSize` into `StudyScreen.tsx`, `QuizScreen.tsx`, `MatchScreen.tsx`, which index into `CARD_TEXT_CLASSES`). SRS knobs instead go through `UserSRSPrefs` in `src/lib/srs/modifiers.ts`.
7. **Tests** — pure logic gets unit tests (`src/lib/srs/__tests__/modifiers.test.ts` is the pattern for knobs); user-visible flows get E2E coverage. Run the suite per `recall-validation-and-qa`.
8. **Docs** — add a row to `docs/CONFIGURATION.md` (and fix, don't copy, any stale defaults — see mismatch #1 above).

## Provenance and maintenance

Facts above verified 2026-07-07 against commit `e8f06ed`. Re-derive before trusting:

- Env vars: `cat .env.example` and `rg "process.env" src`
- User settings + defaults: `rg -A2 "model User" prisma/schema.prisma` (read through line ~53)
- Valid ranges: `rg -A14 "settingsSchema" src/lib/validation.ts`
- API surface: `cat src/app/api/settings/route.ts`
- Consumers of a setting: `rg "cardTextSize|studyTheme|fuzzIntervals|intervalModifier|masteryThresholdDays|dailyNewWords|assumedCheckPerDay" src -l`
- Session-scope persistence: `rg "localStorage" src -l` and `rg "STORAGE_KEY|CARDS_PER_MINUTE|ALL_LIMIT" src`
- Migration state: `ls prisma/migrations`
