# Architecture

A concise tour of how HSK Nest is put together: the data model, the spaced-repetition strategy pattern, the queue/cap logic, and how a request flows through the app.

## Data model (`prisma/schema.prisma`)

- **User** — account + all per-user preferences: `preferredAlgorithm`, `theme`, learning caps (`dailyNewWords`, `assumedCheckPerDay`), and algorithm tuning (`intervalModifier`, `lapseModifier`, `masteryThresholdDays`, `fuzzIntervals`).
- **Language** — `name` + unique `code`. `createdById` is `null` for seeded/global languages; set to a user id for languages that user added.
- **WordList** — belongs to a `Language`. `isPublic` is `true` for seeded starter lists. `createdById` is `null` for seeded lists, or the owner's id for user-created lists.
- **Word** — the language-agnostic unit: `term`, `translation`, optional `phonetic`, and a free-form `metadata` JSON blob (tones, gender, part of speech, audio URLs, frequency rank…). `position` orders words within a list. Deleting a list cascades to its words.
- **UserProgress** — one row per (user, word). Holds an algorithm-agnostic superset of SRS state: `state` (NEW/LEARNING/REVIEW/LAPSED/MASTERED/ASSUMED), SM-2 fields (`easeFactor`, `intervalDays`, `repetitions`), the Leitner `box`, `lapses`, `dueAt`, and scheduling bookkeeping (`introducedAt`, `assumedCheckedAt`). `srsData` is JSON overflow that FSRS uses to store its stability/difficulty state; also reserved for any future strategy. Deleting a word cascades to its progress.
- **ReviewLog** — an append-only history of every grade (`quality`, `algorithm`, interval before/after, `reviewedAt`). Reserved for analytics and future replay/offline sync.

### Ownership & visibility

A list or language is **visible** to a user when it is public/seeded **or** owned by that user. This single rule lives in `src/lib/ownership.ts` (`visibleListWhere`, `visibleLanguageWhere`) and is applied on every read path (`GET /api/lists`, `GET /api/lists/[id]`, `GET /api/languages`, enroll, assume). Mutations are stricter: a list or word is only editable when its (or its parent list's) `createdById` equals the caller — so seeded content is always read-only.

## SRS strategy pattern (`src/lib/srs/`)

Scheduling is a pluggable strategy behind a shared interface:

- `types.ts` — the common `SRSStrategy` shape and the review input/output types.
- `fsrs.ts` — FSRS-5: modern memory-model scheduler (stability/difficulty tracked
  in `srsData`), reads a per-account `desiredRetention` target. **Default for
  new accounts.**
- `sm2.ts` — SuperMemo 2: adjusts `easeFactor` and grows `intervalDays` on success.
- `leitner.ts` — a 5-box system with fixed per-box intervals.
- `index.ts` — a small registry that resolves the user's `preferredAlgorithm` to a strategy.
- `modifiers.ts` — a **modifier layer** applied on top of whichever strategy runs: the interval multiplier, post-lapse interval retention, the mastery cut-off (interval past a threshold → `MASTERED`, stop scheduling), and optional ±5% interval fuzz.

Because `UserProgress` stores a superset of every strategy's needs, switching algorithms never discards state — existing accounts keep their `preferredAlgorithm` even when the new-account default changes.

## Queue & cap logic

The study queue (`GET /api/study/queue`) blends **due reviews** with a capped trickle of **new** words:

- New words are limited by the user's `dailyNewWords`; `introducedAt` records the first-ever review so the daily cap is enforced per calendar day.
- `ASSUMED` (already-known) words are re-checked at most `assumedCheckPerDay` per day, tracked via `assumedCheckedAt`.
- A session can be sized by count (`?limit=N`) or by time (`?minutes=M`), chosen from the dashboard session picker.
- A session can be **scoped** to a language (`?languageId=…`) and/or specific lists (`?listIds=a,b,c`, comma-separated), set from the dashboard scope picker (parsed in `src/lib/studyScope.ts`). Scope only narrows the caller's own due/check/new selection; the daily-cap counters stay **global per day** so scoped sessions can't double-spend the new-word budget. Bad or stale ids degrade to a narrower or empty queue rather than erroring.

Grades are submitted to `POST /api/study/review`, which runs the active strategy + modifiers, writes the new `UserProgress`, and appends a `ReviewLog`.

## Request flow

1. **Auth** — NextAuth (Credentials, JWT). `getCurrentUserId()` (`src/lib/session.ts`) resolves the signed-in user id in server components and route handlers; unauthenticated requests get a 401 (API) or redirect to `/login` (pages).
2. **Validation** — every mutating route parses its body with a Zod schema from `src/lib/validation.ts` and returns a flattened error on failure.
3. **Data** — a single Prisma client singleton (`src/lib/prisma.ts`) talks to SQLite (or Postgres in production).
4. **UI** — App Router server components read data directly via Prisma for the initial render; interactive pieces are client components that call the JSON API routes and `router.refresh()` to re-fetch. Theme is handled by `next-themes` (instant, localStorage) with a server write-through to `User.theme` so the choice follows the account.

The `/study` route renders inside a route-scoped `.dark` wrapper, giving it a permanent dark focus mode independent of the global theme.

Word-strength bands are derived in `src/lib/strength.ts` (`wordStrength`, `STRENGTH_ORDER`, `STRENGTH_META`) — a pure display view over raw SRS state. The words browser and per-list strength view render these through `WordStrengthGrid` (a single-hue intensity heatmap of uniform tiles; replaces the former per-band `WordChipGrid`), reusing `WordHoverCard` for per-word details.
