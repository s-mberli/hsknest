---
name: recall-diagnostics-toolkit
description: Measurement and inspection tools for the Recall SRS app. Use when you need to MEASURE scheduler behavior instead of eyeballing it — inspecting a user's study-queue composition (due reviews, new-word budget, assumed-check budget), verifying SM-2/Leitner intervals and ease-factor trajectories numerically, simulating a grade sequence through the real scheduler code, checking DB health (users, words, progress rows by state, review logs), or answering "what is currently in this user's queue and why?" / "what interval SHOULD this card have gotten?". Use to REPRODUCE or MEASURE an interval/queue numerically with scripts (for theory explanations use srs-theory-reference; for suspected bugs use recall-debugging-playbook). Ships runnable read-only tsx scripts.
---

# Recall Diagnostics Toolkit

Measure, don't eyeball. This skill ships three read-only diagnostic scripts in
`.claude/skills/recall-diagnostics-toolkit/scripts/` plus an interpretation
guide. All commands run from the repo root using relative paths. The repo
directory name contains a space — always quote paths. (Original dev machine
root: `C:\Users\mrks\Documents\claude project`, informational.) All scripts
are READ-ONLY against the database.

All sample outputs below are real, captured 2026-07-07 against the local
`prisma/dev.db` (4 users, 5071 words at capture time).

## When NOT to use this skill

| You actually want | Open instead |
|---|---|
| Understand WHY SM-2/Leitner behaves a certain way (theory, EF math, grade semantics) | `srs-theory-reference` |
| Fix a bug once measurement confirms it (missing card, 401s, Prisma errors) | `recall-debugging-playbook` |
| Change scheduler code, schema, or queue logic | `recall-change-control` + `recall-architecture-contract` |
| Run/write tests or decide merge evidence | `recall-validation-and-qa` |
| Setup, env vars, install failures | `recall-build-and-env` |
| Run/deploy/backup the app | `recall-run-and-operate` |
| Tune or add a user setting | `recall-config-and-settings` |
| Docs, README, licensing | `recall-docs-and-writing` |
| FSRS migration work / research experiments | `recall-fsrs-campaign` / `recall-research-program` |

## Script 1: inspect-queue.ts — one user's queue composition

```
npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/inspect-queue.ts <email>
```

Prints the user's scheduler settings, due reviews right now, new-word budget
used/remaining today (counted via `introducedAt >= local midnight`, excluding
ASSUMED — exactly like the route), assumed-check budget (via
`assumedCheckedAt`), the due-card table, and the next 10 upcoming reviews.

**Mirrors vs approximates** (source of truth: `src/app/api/study/queue/route.ts`):
- MIRRORS: due filter (`dueAt <= now`, state in LEARNING/REVIEW/LAPSED), both
  daily-cap counters (intentionally unscoped, same as the route's invariant
  comment), `startOfLocalDay` from `src/lib/utils.ts`.
- APPROXIMATES: no `?scope=` narrowing (reports globally), no `limit`
  truncation, no quiz-choice generation. If the user studies a scoped session,
  in-app numbers can be a subset of this report.

Unknown email exits code 2 and lists known emails:

```
No user with email "nobody@example.com". Users in DB: 4
Known emails: test@example.com, e2e-1783353019124@example.com, ...
```

Real output (2026-07-07):

```
User: test@example.com  (algorithm: SM2)
Settings: dailyNewWords=10 assumedCheckPerDay=3 intervalModifier=1 lapseModifier=0 masteryThresholdDays=null fuzzIntervals=true
Now: 2026-07-06 23:36  Local day start: 2026-07-06 14:00

Due reviews now:        0
New-word budget:        used 7 / 10, remaining 3 (NEW pool: 13)
Assumed-check budget:   used 0 / 3, remaining 3 (ASSUMED pool: 0)

Next 10 upcoming (not yet due):
term     state     dueAt             intervalDays
-------  --------  ----------------  ------------
hola     REVIEW    2026-07-07 15:45  1.00
gracias  LEARNING  2026-07-07 15:45  1.00
casa     REVIEW    2026-07-07 15:46  1.00
...
```

Note: timestamps print in UTC (ISO); "Local day start" is local midnight
rendered in UTC, so an offset like `14:00` is expected on non-UTC machines.

## Script 2: simulate-schedule.ts — pure scheduler simulation (no DB)

```
npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/simulate-schedule.ts <SM2|LEITNER> <grades> [options]
```

- `<grades>`: comma-separated 0–5 qualities, e.g. `4,4,2,5` (canonical grade/swipe mapping: `srs-theory-reference` §3).
- Options: `--intervalModifier=1.2`, `--lapseModifier=0.5`,
  `--masteryThresholdDays=180`, `--fuzz`. Fuzz is OFF by default here for
  determinism; when `--fuzz` is passed, THIS SCRIPT pins `rng=0.5` so the
  output stays deterministic — the real app uses `Math.random`. (Modifier
  semantics: `srs-theory-reference` §6.)

It imports the REAL production code from `src/lib/srs/` (`getAlgorithm`,
`applyUserModifiers`) and composes them in the same order as the review route:
strategy first, then user modifiers. Fixed start clock 2026-07-07T00:00Z; each
review happens exactly at due time ("perfect student").

Real output:

```
> npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/simulate-schedule.ts SM2 4,4,2,5

#  grade  state     intervalDays  EF     reps  box  lapses  dueAt
-  -----  --------  ------------  -----  ----  ---  ------  ----------
1  4      REVIEW    1.00          2.500  1     1    0       2026-07-08
2  4      REVIEW    6.00          2.500  2     1    0       2026-07-14
3  2      LEARNING  1.00          2.180  0     1    1       2026-07-15
4  5      REVIEW    1.00          2.280  1     1    1       2026-07-16
```

```
> npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/simulate-schedule.ts LEITNER 4,4,2,5 --intervalModifier=1.2

#  grade  state     intervalDays  EF     reps  box  lapses  dueAt
-  -----  --------  ------------  -----  ----  ---  ------  ----------
1  4      REVIEW    2.40          2.500  0     2    0       2026-07-09
2  4      REVIEW    4.80          2.500  0     3    0       2026-07-14
3  2      LEARNING  1.00          2.500  0     1    1       2026-07-15
4  5      REVIEW    2.40          2.500  0     2    1       2026-07-17
```

(Leitner boxes 1–5 → intervals 1/2/4/8/16 days; ×1.2 modifier gives 2.40, 4.80.)

## Script 3: db-stats.ts — DB health readout

```
npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/db-stats.ts
```

Real output (2026-07-07):

```
Database: file:./dev.db

entity        count
------------  -----
users         4
languages     2
wordLists     10
words         5071
userProgress  60
reviewLogs    11
feedback      0

UserProgress by state:
state     count
--------  -----
NEW       49
REVIEW    8
LEARNING  3

Last review: 2026-07-06 15:53 (quality=4, SM2)
```

On an empty DB it prints counts of 0 plus: `Empty database: no users yet.
Seed with `npm run db:seed` or register via the UI.`

**DB resolution:** Prisma auto-loads `.env` (`DATABASE_URL="file:./dev.db"`,
resolved relative to `prisma/schema.prisma` → `prisma/dev.db`). If `.env` is
missing, `scripts/_shared.ts` falls back to an absolute `file:` URL to
`<repoRoot>/prisma/dev.db`, so the scripts survive the space in the repo path.

## Interpretation guide

Healthy baseline: due count small and shrinking during a session; new budget
depletes by exactly the number of new cards graded today; EF stays in
[1.3, ~2.7]; intervals grow roughly ×EF per success under SM-2.

| Observation | Likely meaning | Next step / sibling skill |
|---|---|---|
| Interval differs from expectation | First check `--fuzz` (±5%) and intervalModifier; then re-derive with simulate-schedule | If real code disagrees with theory → `srs-theory-reference`; if DB row disagrees with simulation → `recall-debugging-playbook` |
| Word you expect is missing from queue | Check its state and dueAt via inspect-queue; NEW words are gated by budget, ASSUMED by check budget, scoped sessions filter further | `recall-debugging-playbook` (queue triage section) |
| New budget "used" > cards you studied | E2E runs or another session spent the global daily cap (caps are unscoped by design) | `recall-architecture-contract` for the invariant |
| Budget resets at a weird hour | `startOfLocalDay` is SERVER-local midnight; UTC display offsets are cosmetic | `recall-debugging-playbook` (timezone section) |
| EF pinned at 1.30 for many cards | Repeated failures; expected floor, but many such cards = content too hard or grading bug | `srs-theory-reference` |
| intervalDays huge / dueAt years out | Check masteryThresholdDays unset + high intervalModifier compounding | `recall-config-and-settings` |
| userProgress rows without matching words / orphan counts | Schema/cascade problem | `recall-debugging-playbook`, then `recall-change-control` before fixing |
| Simulation ends with "(card reached MASTERED)" | masteryThresholdDays crossed — cards stop scheduling; intended | `recall-config-and-settings` |
| Scripts crash with Prisma engine/locked-db errors | Environment problem, not data problem | `recall-build-and-env` |

## Built-in diagnostics already in the repo

- `npx prisma studio` — GUI browser for dev.db (also how feedback is triaged).
- Playwright traces: after `npm run test:e2e`, failures leave traces in
  `test-results/`; open with `npx playwright show-trace <path-to-trace.zip>`.
- Vitest single file: `npx vitest run src/lib/srs/__tests__/sm2.test.ts`
  (also `leitner.test.ts`, `modifiers.test.ts`).

## Provenance and maintenance

Facts date-stamped 2026-07-07. Re-verify:

- `npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/db-stats.ts`
- `npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/inspect-queue.ts test@example.com`
- `npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/simulate-schedule.ts SM2 4,4,2,5`
- Mirror drift check: diff the cap/due logic in inspect-queue.ts against
  `src/app/api/study/queue/route.ts` after any queue change.
