---
name: srs-theory-reference
description: Domain-theory knowledge pack for spaced repetition as implemented in Recall. Load when working on or reasoning about SM-2, Leitner, ease factor, intervals, review quality grades, the forgetting curve, lapses, card states (NEW/LEARNING/REVIEW/LAPSED/MASTERED/ASSUMED), user scheduling modifiers (intervalModifier, lapseModifier, masteryThresholdDays, fuzzIntervals), FSRS background, or any code in src/lib/srs/ and the review API. Load to EXPLAIN the math/theory behind an interval or grade — "why did this card get scheduled X days out?", "what does quality 3 mean?", "how does the scheduler work?". (To measure/reproduce numbers with scripts use recall-diagnostics-toolkit; if you believe the result is a bug use recall-debugging-playbook.)
---

# SRS Theory Reference (Recall)

Ground truth verified against repo code on 2026-07-07. Every formula below is read from `src/lib/srs/` and the review API, not from memory. Where external spaced-repetition canon is cited, it is labeled **[external background]**.

## 1. Why spaced repetition works (background)

**[external background]** Memory decays predictably after learning — Ebbinghaus's *forgetting curve* shows retention dropping steeply at first, then flattening. Each successful recall *resets and flattens* the curve: the memory decays more slowly afterward. So the optimal review time is just before you would forget — reviewing earlier wastes time, later means relearning from scratch.

A *spaced-repetition system* (SRS) automates this: it tracks per-card scheduling state and expands the gap between reviews after each success (the *spacing effect*), while shrinking it after failure. Two classic families are implemented in this repo: **SM-2** (SuperMemo-2, 1987 — per-card "ease factor" multiplies a growing interval) and **Leitner** (physical flashcard boxes with fixed intervals per box).

Key terms used throughout:
- **quality / grade**: 0–5 rating of one recall attempt (`ReviewQuality` in `src/lib/srs/types.ts`). q ≥ 3 = success, q < 3 = failure everywhere in this repo.
- **interval**: days until the card is due again (`intervalDays`).
- **ease factor (EF)**: SM-2's per-card multiplier on interval growth.
- **lapse**: a failed review of a previously-seen card (`lapses` counter).
- **repetitions**: count of consecutive successful reviews (SM-2; reset to 0 on failure).
- **box**: Leitner box number 1–5.

## 2. Architecture of the scheduler

Pure-function pipeline, all in `src/lib/srs/`:

```
POST /api/study/review  (src/app/api/study/review/route.ts)
  → getAlgorithm(user.preferredAlgorithm)   // "SM2" | "LEITNER", registry in index.ts
  → algorithm.calculateNextReview(state, quality, now)   // sm2.ts or leitner.ts
  → applyUserModifiers(prev, result, quality, prefs, now)  // modifiers.ts
  → persist to UserProgress + append ReviewLog (transaction)
```

`SRSState` (types.ts) mirrors `UserProgress` columns: `state, easeFactor, intervalDays, repetitions, box, lapses, dueAt, lastReviewedAt, srsData?`. Both algorithms read/write the same shape and carry each other's fields untouched, so users can switch algorithms without data loss ("algorithm-switch safety" — this repo's choice). All functions are pure; `addDays` is exact ms arithmetic (days × 86 400 000 ms), no timezone/day-boundary rounding.

## 3. Grade semantics: what the UI actually sends

The 0–5 scale is accepted by the API (`reviewSchema` in `src/lib/validation.ts`), but the UI only ever sends **1, 3, 4, 5**:

| Source | Gesture / event | Quality sent |
|---|---|---|
| Flashcards (`src/hooks/useStudySession.ts`, `QUALITY_BY_DIRECTION`) | swipe left ("forgot") | 1 |
| | swipe down ("hard / barely") | 3 |
| | swipe right ("knew") | 4 |
| | swipe up ("easy") | 5 |
| Quiz (`src/components/study/QuizScreen.tsx`) | wrong / right answer | 1 / 4 |
| Matching pairs (`src/components/study/MatchScreen.tsx`) | missed / matched cleanly | 1 / 4 |

Both algorithms branch only on **q ≥ 3 vs q < 3**; SM-2 additionally uses the exact q value in its EF formula. Qualities 0 and 2 are valid inputs but currently unreachable from the UI (2026-07-07).

## 4. SM-2 as implemented (`src/lib/srs/sm2.ts`)

Initial state: EF = 2.5, interval 0, repetitions 0, state NEW, due immediately.

**Ease-factor update** — matches canonical SuperMemo-2 exactly, applied on *every* review (success or failure):

```
EF' = max(1.3, EF + 0.1 − (5 − q) · (0.08 + (5 − q) · 0.02))
```

Per-grade EF delta: q=5 → +0.10, q=4 → 0, q=3 → −0.14, q=2 → −0.32, q=1 → −0.54, q=0 → −0.80.

**Success (q ≥ 3):** repetitions += 1, state → REVIEW, interval by repetition count *before* this review:

| Prior repetitions | New interval |
|---|---|
| 0 | 1 day |
| 1 | 6 days |
| ≥ 2 | `round(prevInterval × EF')` |

Note the growth step uses the **updated** EF' (canonical SM-2 also updates EF before the interval calc — this matches).

**Failure (q < 3, a "lapse"):** repetitions → 0, interval → 1 day, lapses += 1, state → **LEARNING**.

**Deviations from canonical SuperMemo-2** (each is this repo's choice):
1. **No same-session repetition loop.** Canonical SM-2 re-asks q < 4 items until q ≥ 4 within the session. Here every answer schedules exactly one future review; the study hook only re-queues a card once if the *network POST fails*, never for low quality. Rationale: mobile swipe UX — one swipe, one decision.
2. **Failed cards get interval 1 day, not 0/same-day.** Canonical resets repetitions but re-reviews immediately; here the card comes back tomorrow. Rationale: no intra-day scheduler exists; due-queue granularity is a date.
3. **EF is updated even on failure.** Canonical SM-2 (common reading) updates EF only on graded recall during scheduled repetition; some implementations skip EF update when q < 3. This repo always applies the delta (the code comment says "always applied, per SM-2" — it's a defensible reading of the original algorithm, but flagged here because implementations differ). Effect: repeated failures grind EF toward the 1.3 floor.
4. **Explicit card-state machine and lapse counter** (LEARNING/REVIEW/etc., `lapses`) — additions on top of SM-2, used by UI strength badges (`src/lib/strength.ts`: LAPSED or lapses ≥ 3 → "shaky") and queue filters.
5. **User modifier layer on top** (section 6) — canonical SM-2 has no such layer.

## 5. Leitner as implemented (`src/lib/srs/leitner.ts`)

**5 boxes**, fixed intervals (doubling): 

| Box | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Interval (days) | 1 | 2 | 4 | 8 | 16 |

- **q ≥ 3:** box = min(box + 1, 5), state → REVIEW. A card in box 5 stays in box 5 (interval stays 16 days forever, absent modifiers).
- **q < 3:** box → 1 (full reset, not one-box demotion), lapses += 1, state → LEARNING.
- Interval is always `BOX_INTERVALS[box − 1]` of the *new* box; dueAt = now + interval.
- `easeFactor` and `repetitions` are carried through untouched — deliberate, so switching back to SM-2 resumes where it left off.

## 6. The modifier layer (`src/lib/srs/modifiers.ts`, `applyUserModifiers`)

Pure post-processor applied to *every* algorithm result (order as in code):

1. **intervalModifier** (success only, q ≥ 3): `intervalDays *= intervalModifier`. E.g. 1.2 = 20% longer everywhere.
2. **lapseModifier** (failure, only if > 0): `intervalDays = max(1, prevInterval × lapseModifier)`. Overrides the algorithm's 1-day reset — e.g. lapseModifier 0.5 on a 20-day card → 10 days instead of 1. If 0, the algorithm's reset stands.
3. **fuzzIntervals** (if enabled and intervalDays ≥ 2): `intervalDays *= (0.95 + rng() × 0.10)` — uniform ±5% jitter, prevents cards reviewed together from staying clumped. RNG injectable for tests. Sub-2-day intervals are never fuzzed.
4. **masteryThresholdDays** (if set and > 0 and adjusted intervalDays ≥ threshold): state → **MASTERED**.
5. `dueAt` recomputed as now + adjusted intervalDays. Note intervalDays may end up **fractional** (modifiers/fuzz do not round); `addDays` handles fractional days in ms.

Prefs come from `User` columns: `intervalModifier`, `lapseModifier`, `masteryThresholdDays` (nullable = never master), `fuzzIntervals`.

## 7. Card state machine

States (enum in `prisma/schema.prisma`, `CardState` in types.ts): NEW, LEARNING, REVIEW, LAPSED, MASTERED, ASSUMED.

| Transition | Fires when |
|---|---|
| — → NEW | enrollment; `initialState()` — due immediately, never reviewed |
| any → REVIEW | any successful review (q ≥ 3) in either algorithm |
| any → LEARNING | any failed review (q < 3) in either algorithm; also ASSUMED card failed its check |
| → MASTERED | modifier layer, when adjusted interval ≥ masteryThresholdDays |
| → ASSUMED | bulk "mark as known" endpoints only (`/api/lists/[id]/assume`, `/api/words/weak/assume`) — never from a review |
| ASSUMED → REVIEW | assumed-check passed (q ≥ 3): handled specially in `route.ts`, bypasses the algorithm — repetitions = 1, interval = 30 days (`ASSUMED_CONFIRMED_INTERVAL_DAYS`), then modifiers apply |
| ASSUMED → LEARNING | assumed-check failed (q < 3): reset to `initialState()` with state LEARNING, interval 1 day |

**LAPSED is currently never written by the schedulers** (2026-07-07): failures set LEARNING. LAPSED exists in the enum and is *read* by queue/stats/strength code (`DUE_STATES`, `src/lib/stats.ts`, `src/lib/strength.ts`) — treat it as reserved/legacy; don't assume reviews produce it.

Queue behavior (context): only LEARNING/REVIEW/LAPSED count as due; MASTERED and ASSUMED are excluded from normal scheduling. ASSUMED cards re-enter via a daily assumed-check cap (`assumedCheckPerDay`, `assumedCheckedAt`); assumed checks don't consume the daily NEW budget (`introducedAt` left untouched).

## 8. Worked examples (repo code paths, no modifiers: intervalModifier 1, lapseModifier 0, fuzz off, no mastery threshold)

### SM-2: one word, five reviews

Start: NEW, EF 2.5, interval 0, reps 0.

| # | Quality | EF after | Reps | Interval | State |
|---|---|---|---|---|---|
| 1 | 4 (swipe right) | 2.5 + 0 = **2.5** | 1 | **1** (first success) | REVIEW |
| 2 | 4 | **2.5** | 2 | **6** (second success) | REVIEW |
| 3 | 5 (swipe up) | 2.5 + 0.10 = **2.6** | 3 | round(6 × 2.6) = **16** | REVIEW |
| 4 | 3 (swipe down) | 2.6 − 0.14 = **2.46** | 4 | round(16 × 2.46) = **39** | REVIEW |
| 5 | 1 (swipe left) | 2.46 − 0.54 = **1.92** | 0 | **1** (lapse) | LEARNING, lapses 1 |
| 6 | 4 | **1.92** | 1 | **1** (reps was 0) | REVIEW |

After a lapse the card walks the 1 → 6 → round(6 × EF) ladder again, but with the damaged EF (next growth step: round(6 × 1.92) = 12, vs 16 pre-lapse).

With **lapseModifier 0.5**, review #5 instead gets max(1, 39 × 0.5) ≈ **19.5 days** (fractional is kept).

### Leitner: same word

| # | Quality | Box | Interval | State |
|---|---|---|---|---|
| 1 | 4 | 2 | 2 | REVIEW |
| 2 | 4 | 3 | 4 | REVIEW |
| 3 | 4 | 4 | 8 | REVIEW |
| 4 | 1 | **1** | 1 | LEARNING, lapses 1 |
| 5 | 4 | 2 | 2 | REVIEW |
| 6–7 | 4, 4 | 3, 4 | 4, 8 | REVIEW |
| 8 | 4 | 5 | 16 | REVIEW |
| 9+ | 4 | 5 (cap) | 16 | REVIEW |

Note review #1 gives interval 2 (box 2), not 1 — Leitner uses the *destination* box's interval.

## 9. FSRS primer (background for the sibling `recall-fsrs-campaign` skill)

**[external background]** FSRS (Free Spaced Repetition Scheduler) is the modern replacement for SM-2 (used by Anki since ~2023). Instead of one hand-tuned ease factor, it models each memory with three variables — **Difficulty** (how hard the item is), **Stability** (days until retrievability falls to 90%), and **Retrievability** (current recall probability) — and updates them with formulas whose ~20 parameters are **fitted by machine learning on the user's own review history**. The scheduler then picks the interval that hits a target retention (e.g. 90%), typically yielding 20–30% fewer reviews for the same retention than SM-2.

Why it matters here: fitting FSRS needs a complete per-review history and a place to store its state. That is exactly why this repo already has:
- `ReviewLog` (schema.prisma): quality, algorithm, intervalBefore/After, reviewedAt per review — the training data.
- `UserProgress.srsData Json?`: "algorithm-specific overflow (future FSRS params, etc.)" — where D/S/R would live. `SRSState.srsData` is already plumbed through the review route and preserved on write.

Adding FSRS = implementing another `SRSAlgorithm` (types.ts interface) reading/writing `srsData`, registered in `index.ts`. Details belong to `recall-fsrs-campaign`, not this skill.

## When NOT to use this skill

This skill is theory + as-built scheduler semantics only. Use siblings instead for:
- **recall-change-control** — before *changing* any SRS code, schema, or migration (gating rules, proof requirements).
- **recall-architecture-contract** — overall app structure, module boundaries, API surface.
- **recall-fsrs-campaign** — actually planning/implementing FSRS (this skill only gives the primer).
- **recall-build-and-env / recall-run-and-operate** — building, running, deploying.
- **recall-config-and-settings** — where user prefs live and how settings UI maps to them.
- **recall-debugging-playbook / recall-diagnostics-toolkit** — investigating live scheduling bugs.
- **recall-validation-and-qa** — test strategy and QA gates.
- **recall-docs-and-writing / recall-research-program** — prose deliverables and research work.

## Provenance and maintenance

Facts verified 2026-07-07 by reading the files below. Re-verify before trusting numbers:

- `Read src/lib/srs/sm2.ts src/lib/srs/leitner.ts src/lib/srs/modifiers.ts src/lib/srs/types.ts src/lib/srs/index.ts`
- `Read src/app/api/study/review/route.ts` (ASSUMED handling, 30-day constant, pipeline order)
- `Read src/hooks/useStudySession.ts` (QUALITY_BY_DIRECTION), `src/components/study/QuizScreen.tsx`, `src/components/study/MatchScreen.tsx` (grades sent)
- `Read prisma/schema.prisma` (CardState enum, UserProgress, ReviewLog, srsData)
- Run the SRS suite: `npm test -- src/lib/srs` (or `npm test` for everything)
