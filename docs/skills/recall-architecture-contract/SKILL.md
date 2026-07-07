---
name: recall-architecture-contract
description: The load-bearing architecture contract for the Recall SRS vocabulary trainer. Load when touching the Prisma schema, src/lib/srs/* (SM-2, Leitner, modifiers), ownership/visibility rules, the study queue and daily caps, auth/validation/request flow — or when asking "why is the data model shaped this way?", "what invariants must hold?", "can I add a language-specific field?", "how does algorithm switching work?", or "what are the known weak points?". Pairs with recall-change-control for gating.
---

# Recall Architecture Contract

The design decisions this app depends on, why they exist, and the invariants any change must preserve. Verified against source on **2026-07-07**. Ground-truth files: `prisma/schema.prisma`, `src/lib/`, `docs/ARCHITECTURE.md`, `CLAUDE.md`.

Jargon: **SRS** = spaced-repetition system (scheduler that decides when a card is next shown). **Seeded content** = rows created by the seed script, owned by no user.

## 1. Data model (`prisma/schema.prisma`)

| Model | Role | Cascade / ownership notes |
|---|---|---|
| `User` | Account + ALL per-user prefs: `preferredAlgorithm` (SM2/LEITNER), theme fields, caps (`dailyNewWords`, `assumedCheckPerDay`), tuning (`intervalModifier`, `lapseModifier`, `masteryThresholdDays`, `fuzzIntervals`) | — |
| `Language` | `name` + unique `code` | `createdById: null` = seeded/global |
| `WordList` | Belongs to a `Language` | `createdById: null` + `isPublic: true` = seeded; NO cascade from Language |
| `Word` | `term`, `translation`, `phonetic?`, `metadata Json?`, `position` | `onDelete: Cascade` from WordList |
| `UserProgress` | One row per `(userId, wordId)` (unique). Superset SRS state — see §2 | Cascade from both User and Word; hot index `[userId, dueAt]` |
| `ReviewLog` | Append-only grade history: `quality` 0–5, `algorithm`, interval before/after, `reviewedAt` | Cascade from User; index `[userId, reviewedAt]` |
| `Feedback` | In-app bug/idea reports, triaged in Prisma Studio | Cascade from User |

### Invariant: language-agnostic word contract (CLAUDE.md rule)

**Never add a language-specific column** (no `pinyin`, no `kanji`, no `gender`). The only word fields are `term` / `translation` / `phonetic` (optional) / `metadata` (free-form JSON for tones, radicals, audio URLs, POS, frequency rank). This is what makes the app multi-language without migrations. If a feature "needs" a new language field, it goes in `metadata`.

## 2. SRS strategy pattern (`src/lib/srs/`)

| File | Contract |
|---|---|
| `types.ts` | `SRSAlgorithm` interface: `id`, `initialState(now)`, `calculateNextReview(state, quality, now)` — **pure, never mutates input**. `SRSState` mirrors UserProgress columns. Quality 0–5 (canonical grade/swipe mapping: `srs-theory-reference` §3). |
| `sm2.ts` | SuperMemo 2. EF clamped to floor 1.3; fail (q<3) resets reps, interval 1d, `lapses++`, state LEARNING. |
| `leitner.ts` | 5 boxes, `BOX_INTERVALS = [1,2,4,8,16]` days. Success promotes (cap 5), fail resets to box 1. Carries `easeFactor`/`repetitions` through untouched — deliberate, for switch safety. |
| `index.ts` | Registry `{ SM2, LEITNER }`; `getAlgorithm(type)` throws on unknown. New strategies register here. |
| `modifiers.ts` | `applyUserModifiers(prev, result, quality, prefs, now, rng?)` — pure post-processor applied AFTER any strategy: interval multiplier on success, `max(1, prevInterval * lapseModifier)` on lapse, ±5% fuzz when interval ≥ 2, MASTERED cut-off, recomputes `dueAt`. Injectable `rng` for deterministic tests. Canonical modifier semantics: `srs-theory-reference` §6. |

### Invariant: superset state = lossless algorithm switching

`UserProgress` carries fields for **every** strategy simultaneously (SM-2's `easeFactor`/`intervalDays`/`repetitions` AND Leitner's `box`), so a user flipping `preferredAlgorithm` loses nothing. Any new strategy must (a) preserve fields it doesn't use and (b) put its own params in the `srsData` JSON column — plus `ReviewLog` history for replay. Both are reserved for FSRS; **do not repurpose `srsData` for anything else.**

**Reserved JSON columns (this skill is the single home of this list):** `UserProgress.srsData` → per-card strategy state (FSRS difficulty/stability etc.); `User.settings` → candidate store for per-user fitted parameters (e.g. FSRS weights — see `recall-fsrs-campaign`). Neither is written by any code yet.

Strategy + modifier functions are pure. Side effects (DB writes, ReviewLog append) live only in `POST /api/study/review`.

## 3. Ownership & visibility

**Single rule, single file: `src/lib/ownership.ts`.**

- `visibleListWhere(userId)` → `isPublic: true OR createdById: userId`
- `visibleLanguageWhere(userId)` → `createdById: null OR createdById: userId`

Invariants:
1. **Every read path** for lists/languages ANDs one of these in (GET /api/lists, /api/lists/[id], /api/languages, enroll, assume). Never inline the OR by hand — use the helpers.
2. **Mutations are stricter**: edit/delete requires `createdById === callerId` on the list (or the word's parent list). Since seeded content has `createdById: null`, **seeded content is read-only for everyone** by construction.

## 4. Study queue & daily caps

Queue: `GET /api/study/queue` (route at `src/app/api/study/queue/route.ts`) blends due reviews with a capped trickle of new words. Scope parsing lives in `src/lib/studyScope.ts`.

- **Caps are global per calendar day, even when the session is scoped.** The cap counters count `introducedAt >= dayStart` / `assumedCheckedAt >= dayStart` across ALL of the user's progress rows, not just the scoped subset — so a language/list-scoped session can't double-spend the `dailyNewWords` budget.
- Bookkeeping: the **review route** stamps `introducedAt` on a card's first-ever review and `assumedCheckedAt` when an ASSUMED card is checked. Don't stamp these anywhere else.
- **Degrade, never error**: `parseQueueQuery` uses lenient Zod coercion (`.catch(undefined)`) — junk/stale query params fall back to defaults; bad `listIds`/`languageId` just narrow to a smaller or empty queue. `scopeToWordWhere` only ever narrows the caller's own rows (queue always ANDs `userId`), so arbitrary ids can't leak data.
- Session sizing: `?minutes=M` wins over `?limit=N` (M × 5 cards/min, `CARDS_PER_MINUTE = 5`), cap 500, default 20.

## 5. Request flow

1. **Auth** — NextAuth Credentials + JWT. `getCurrentUserId()` in `src/lib/session.ts` is the only way to resolve the caller; unauthenticated → 401 (API) or redirect to `/login` (pages). **Guest mode**: `POST /api/auth/guest` (`src/app/api/auth/guest/route.ts`) creates a real throwaway account (`guest-<hex>@guest.local`, random password returned exactly once, client signs in with it immediately), rate-limited 5/hour/IP via `x-forwarded-for`, and auto-enrolls the smallest non-empty seeded list so the demo is studyable immediately.
2. **Validation** — every mutating route **that accepts a body** parses it with a Zod schema from `src/lib/validation.ts` (all schemas centralized there; return flattened errors). Adding a body-accepting mutating route without a schema violates the contract. (The guest route takes no body.)
3. **Data** — one Prisma singleton, `src/lib/prisma.ts`.
4. **UI split** — server components read Prisma directly for initial render; client components mutate via JSON API then `router.refresh()`. No client-side Prisma, no server actions (as of 2026-07-07).
5. **`/study` dark mode** — the study route renders inside a route-scoped `.dark` wrapper (permanent focus mode independent of the global theme; `User.studyTheme = "follow"` opts out). Don't "fix" this by toggling the global theme.

Client-side grade posting for practice modes goes through `src/lib/postReview.ts` (single retry, tolerates 404).

## 6. Known weak points — stated plainly

| Weak point | Reality (2026-07-07) |
|---|---|
| SQLite single-writer | `schema.prisma` says "swap to postgresql for VPS deploy" — the switch is documented but **not yet exercised**. Concurrent-write pressure will serialize/fail on SQLite. |
| Rate limiter | `src/lib/rateLimit.ts` is an in-process `Map` (fixed window). Resets on restart, per-instance only. Fine for a single VPS; needs Redis before scaling out (the file says so itself). |
| No email verification / password reset | Credentials signup is unverified; a forgotten password is unrecoverable through the UI. Guest accounts (`guest-*@guest.local`) are unrecoverable **by design** — the password is shown to the client once and never again. |
| Calendar-day caps & timezone | `startOfLocalDay` (`src/lib/utils.ts`) uses the **server's** local timezone, not the user's. Cap resets happen at server-midnight; users in distant timezones see caps reset mid-day. Also used by `src/lib/stats.ts`. |
| `applyUserModifiers` fuzz | Uses `Math.random` by default — non-deterministic scheduling unless tests inject `rng`. Known and intentional, but remember it when reproducing schedules. |

## When NOT to use this skill

- Classifying whether a change is allowed / migration safety / merge gates → `recall-change-control`
- SM-2/Leitner/FSRS math and research background → `srs-theory-reference`, `recall-research-program`, `recall-fsrs-campaign`
- Building, env vars, Docker, deploy → `recall-build-and-env`, `recall-run-and-operate`
- Runtime settings and configuration knobs → `recall-config-and-settings`
- Debugging a live issue or gathering diagnostics → `recall-debugging-playbook`, `recall-diagnostics-toolkit`
- Tests/QA process → `recall-validation-and-qa`
- Writing docs → `recall-docs-and-writing`

## Provenance and maintenance

Re-verify claims with:

- Schema: `cat prisma/schema.prisma`
- Strategy pattern: `ls src/lib/srs/ && cat src/lib/srs/types.ts src/lib/srs/index.ts src/lib/srs/modifiers.ts`
- Ownership: `cat src/lib/ownership.ts`
- Caps/scope: `grep -n "introducedAt\|assumedCheckedAt\|dayStart" src/app/api/study/queue/route.ts` and `cat src/lib/studyScope.ts`
- Request flow: `cat src/lib/session.ts src/lib/validation.ts src/lib/rateLimit.ts` and `docs/ARCHITECTURE.md`
