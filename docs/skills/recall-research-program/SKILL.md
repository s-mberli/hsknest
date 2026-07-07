---
name: recall-research-program
description: The research program for Recall's scheduling science. Load when generating or evaluating research ideas, retention analytics, algorithm comparison (SM-2 vs Leitner vs future FSRS), retention studies on ReviewLog data, evaluating a scheduling hypothesis, designing an offline experiment or simulation, asking "is this SRS idea worth pursuing?", "what open problems could this project attack?", or "what's the evidence bar for accepting a scheduling claim?".
---

# Recall Research Program

Recall is not just an app; it owns a rare dataset: an append-only `ReviewLog` of every grade, per user, per algorithm, on a platform where users can switch algorithms. This skill defines (A) the research FRONTIER — open problems where this repo could advance the state of the art — and (B) the METHODOLOGY — the discipline that turns a hunch into an accepted result here.

Everything below labeled **open** or **candidate** is unproven. Do not present it as a capability of the app.

## When NOT to use this skill

| You actually want | Use instead |
|---|---|
| Build/ship the FSRS engine itself | `recall-fsrs-campaign` |
| Established SRS theory (SM-2 math, forgetting curve, grade semantics) | `srs-theory-reference` |
| Measurement/analysis scripts and how to run them | `recall-diagnostics-toolkit` |
| Approving/classifying a code change that results from research | `recall-change-control` |
| Schema invariants and why the data model is shaped this way | `recall-architecture-contract` |

## The repo's research assets (verified 2026-07-07)

- `prisma/schema.prisma` → `ReviewLog`: `userId`, `wordId`, `quality` (0–5), `algorithm` (SM2 | LEITNER), `intervalBefore`, `intervalAfter`, `reviewedAt`. Append-only; indexed on `[userId, reviewedAt]`.
- `User.preferredAlgorithm` is switchable per user; each log row stamps the algorithm active at review time (`src/app/api/study/review/route.ts`).
- `UserProgress` carries an algorithm-agnostic state superset plus `srsData Json?` overflow for future per-card parameters (FSRS stability/difficulty).
- Pluggable strategies in `src/lib/srs/` (`types.ts` defines the pure `SRSAlgorithm` interface — `calculateNextReview(state, quality, now)` is pure and replayable, which makes offline simulation on real logs cheap).
- ASSUMED mechanism: `CardState.ASSUMED` + `User.assumedCheckPerDay` cap + `UserProgress.assumedCheckedAt`; the review route graduates a confirmed assumed card straight to a 30-day REVIEW interval (`ASSUMED_CONFIRMED_INTERVAL_DAYS = 30` in `src/app/api/study/review/route.ts`) or restarts it as LEARNING on failure.
- `Feedback` table: user-reported bugs/ideas, triaged in Prisma Studio.

## Part A — Research frontier

### Problem 1 (open): Per-user algorithm comparison on real logs

**Why SOTA falls short.** Published algorithm comparisons (Anki/FSRS benchmark work — external claim, verify current literature at execution time) are almost entirely between-user or between-platform: different users, different material, different apps. Within-user, same-material, cross-algorithm data is nearly nonexistent because platforms lock users to one scheduler.

**This repo's asset.** Users switch `preferredAlgorithm` freely, and every `ReviewLog` row records which algorithm produced the schedule plus `intervalBefore`/`intervalAfter`. A user who studies under SM2 for a month and LEITNER for a month generates paired within-user data almost no platform has.

**First three steps in this repo.**
1. Write `scripts/research/algo-compare.ts` (read-only Prisma queries against `ReviewLog`): per user × algorithm, compute recall rate = P(quality ≥ 3) bucketed by `intervalBefore`.
2. Identify "switcher" users: users whose logs contain both `SM2` and `LEITNER` rows; restrict the comparison to them and to overlapping interval buckets.
3. Add a selection-bias note: switching is voluntary and time-ordered (learning effects, novelty). Model reviewedAt as a covariate or use within-user before/after matching before claiming anything.

**You have a result when** the retention difference between SM2 and LEITNER at matched intervals is estimated with confidence intervals from real logs (bootstrap over users), and the interval excludes zero — or demonstrably includes it, which is also a publishable-grade negative.

### Problem 2 (open): FSRS parameter fitting for small self-hosted datasets

**Why SOTA falls short.** Standard FSRS fitting (external claim, 2026-07-07: the reference optimizer targets on the order of ~1000+ reviews per user; verify against the current FSRS docs at execution time) underperforms or refuses on small histories. Most self-hosters have far fewer reviews than a decade-long Anki user.

**This repo's asset.** Full ownership of every user's complete log from day one, plus a population of users on one instance — the natural setting for hierarchical/Bayesian shrinkage: fit population priors, shrink per-user parameters toward them, and quantify how many reviews are needed before personal parameters beat the prior.

**Scope boundary.** `recall-fsrs-campaign` ships the FSRS engine (strategy in `src/lib/srs/`, params in `UserProgress.srsData`). This program owns the *fitting research*: how to estimate parameters from small logs. Coordinate before touching shared surfaces.

**First three steps in this repo.**
1. Write `scripts/research/export-logs.ts` producing an anonymized per-user review sequence (word id hashed, `quality`, `reviewedAt`, `intervalBefore`) from `ReviewLog`.
2. Implement log-likelihood evaluation of a candidate parameter set offline: replay each user's sequence through a candidate FSRS forward model and score predicted vs. actual P(quality ≥ 3). No app code touched.
3. Compare three estimators on held-out reviews (last 20% of each user's log): default FSRS params, per-user MLE, per-user shrunk toward instance-population prior.

**You have a result when** the shrinkage estimator beats both defaults and raw per-user MLE on held-out log-loss for users with < N reviews, with N identified — i.e., you can state "below N reviews, use the prior."

### Problem 3 (candidate): Practice-mode signal fusion

**Ground truth (verified 2026-07-07).** Quiz and matching feed the SAME scheduler as flashcards with the SAME grade values: `QuizScreen.tsx` posts `quality = isRight ? 4 : 1` and `MatchScreen.tsx` posts `wasMissed ? 1 : 4` via `src/lib/postReview.ts` → `POST /api/study/review` — identical to swipe-right = 4 / swipe-left = 1 on flashcards (canonical mapping: `srs-theory-reference` §3). Critically, `ReviewLog` has **no mode/source column**: a multiple-choice success is currently indistinguishable from a free-recall success in the log.

**Open question.** Recognition (4-choice quiz, ~25% guess floor; matching, even easier) is a weaker memory signal than free recall. Should it earn the same interval growth? Nobody has a per-user answer because no platform logs both signals against one scheduler — Recall does, except it doesn't *label* them yet.

**First three steps in this repo.**
1. Via `recall-change-control`: propose adding a nullable `mode` column ("flashcard" | "quiz" | "match") to `ReviewLog` and threading it through `postReview.ts`, the flashcard submit path, and `reviewSchema` in `src/lib/validation.ts`. Nullable = backward-compatible; old rows stay unlabeled.
2. Until that ships, prototype on existing data: quiz/match sessions produce bursts of reviews with sub-second-to-few-second spacing on non-due cards — write a heuristic session classifier in `scripts/research/` and validate it manually against your own known sessions. Label it a heuristic.
3. Once labeled data accrues, measure conditional retention: P(next flashcard review has quality ≥ 3 | prior success was quiz) vs. (| prior success was flashcard), at matched intervals.

**You have a result when** a fitted retention model assigns measurably different memory strength to quiz success vs. recall success (difference with CI excluding zero), justifying (or refuting) a mode-specific grade discount.

### Problem 4 (candidate): Assumed-known validation

**Ground truth (verified 2026-07-07).** Users mark words ASSUMED (bulk via `src/app/api/lists/[id]/assume/route.ts` and `src/app/api/words/weak/assume/route.ts`); the queue reintroduces up to `assumedCheckPerDay` (default 3) per day; on check, quality ≥ 3 graduates the card to a flat 30-day interval, quality < 3 restarts it as LEARNING with a 1-day interval (`src/app/api/study/review/route.ts`).

**Why it's interesting.** "I already know this word" is an unstudied self-assessment signal. The check failure rate is a direct calibration measurement, and the fixed 30-day graduation interval is a guess with no empirical basis.

**First three steps in this repo.**
1. Query the failure rate: among first reviews of cards where `assumedCheckedAt` was stamped, what fraction had `quality < 3`? (Join `ReviewLog` to `UserProgress`; the first log row for an assumed card at `intervalBefore = 0` with the assumed-check timing is the check. If ambiguous, add this to the `mode` column proposal in Problem 3.)
2. Track downstream survival: of confirmed-assumed cards (graduated to 30 days), what fraction pass their first 30-day review vs. ordinary cards that reached a 30-day interval by studying?
3. If survival differs, propose (via change control) making `ASSUMED_CONFIRMED_INTERVAL_DAYS` a derived value — e.g., calibrated per instance from measured survival — instead of the hardcoded 30.

**You have a result when** you can state, with data, "X% of assumed words fail their check, and confirmed-assumed cards retain at Y% vs. Z% for studied cards at 30 days" — numbers that either validate 30 days or dictate its replacement.

## Part B — Research methodology

### The evidence bar

A research claim is **accepted** here only when ALL of the following hold:

1. **One mechanism explains all observations** — including the negative and awkward ones. A hypothesis that explains the wins but shrugs at the losses is not accepted; it is refined or retired.
2. **Numbers predicted before the analysis runs.** Write the predicted effect size/direction down (in the experiment note) BEFORE executing the query or simulation. Post-hoc "that's about what I expected" does not count.
3. **Survives an assigned adversarial-refutation pass.** Before acceptance, someone (or a fresh model session with no stake in the result) is explicitly assigned to break it: alternative explanations, selection bias, leakage, coding bugs. The claim is accepted only if the refutation attempt is documented and failed.

### The idea lifecycle

```
hunch → written prediction → experiment → adopted change  OR  documented retirement
```

| Stage | Rule |
|---|---|
| Hunch | Free. Write it down with its source (log pattern, feedback row, roadmap item). |
| Written prediction | Falsifiable, numeric, dated, BEFORE any analysis runs. |
| Experiment | Offline analysis of `ReviewLog` or simulation via the pure strategies in `src/lib/srs/` — NEVER on live users' schedules without going through `recall-change-control`. Scripts live in `scripts/research/` and are read-only against the database. |
| Adopted change | Any resulting code change routes through `recall-change-control` (scheduler changes carry the highest proof bar). |
| Retirement | Dead ideas are recorded in the ledger below with the falsifying observation. Retired ideas are cheap; zombie ideas are expensive. |

### Where good ideas come from here

- **The ReviewLog itself.** Anomalies in retention-by-interval curves, per-user variance, quality distributions. This is the primary instrument.
- **The Feedback table** (`Feedback` model; triaged in Prisma Studio). "This word came back too soon" complaints are hypotheses in disguise.
- **README.md roadmap.** The owner's stated ambitions (retention analytics, algorithm comparison, FSRS+) — check it before proposing a direction to avoid duplicating planned work.

### Retired ideas ledger

| Date | Idea | Prediction | Falsifying observation |
|---|---|---|---|
| — | (empty — nothing retired yet) | | |

Append rows here when an idea is retired. Never delete rows.

## Provenance and maintenance

Verified against the repo on 2026-07-07. Re-verify before relying on ground-truth claims:

- ReviewLog columns: `grep -n "model ReviewLog" -A 14 prisma/schema.prisma`
- Practice grade mapping: `grep -rn "postReview(" src/components/study/` (expect `4 : 1` / `1 : 4`)
- ASSUMED mechanics + 30-day constant: `grep -n "ASSUMED" src/app/api/study/review/route.ts`
- Strategy purity/interface: `grep -n "calculateNextReview" src/lib/srs/types.ts`
- External FSRS fitting claims: re-check FSRS optimizer docs at execution time; do not trust the ~1000-review figure without confirming.
