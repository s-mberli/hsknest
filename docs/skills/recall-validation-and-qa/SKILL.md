---
name: recall-validation-and-qa
description: Testing and evidence rules for the Recall SRS app. Use when writing or running tests (unit or E2E), proving that a change works, deciding what evidence a PR needs before merge, adding a new test file, extending the E2E journey, or verifying a scheduler (SM-2/Leitner/modifiers) change. Covers npm test, vitest usage, Playwright E2E, the evidence bar per change class, and the fixed-clock pattern for SRS tests.
---

# Recall: Validation and QA

What counts as evidence in this repo, what tests exist, and how to add more.

**The owner's rule (README Contributing):** scheduler changes require spec justification + unit tests before merge; `npm test` and `npm run build` must pass for any PR. No exceptions.

## When NOT to use this skill

- Classifying whether a change is even allowed, or migration/review gating → `recall-change-control`
- Layering rules, module boundaries, data model → `recall-architecture-contract`
- SM-2 math, why the algorithm behaves as it does → `srs-theory-reference`
- Install/env problems, `npm run build` failing for environment reasons → `recall-build-and-env`
- Running/deploying the app itself → `recall-run-and-operate`
- Runtime settings/config → `recall-config-and-settings`
- Diagnosing a live bug → `recall-debugging-playbook`; inspection tooling → `recall-diagnostics-toolkit`
- Docs/README work → `recall-docs-and-writing`
- FSRS migration work → `recall-fsrs-campaign`; research questions → `recall-research-program`

## Test inventory (verified 2026-07-07: 8 files, 96 tests, all passing)

### Unit tests — `src/lib/__tests__/`

| File | Covers |
|---|---|
| `import.test.ts` | `parseDelimited` CSV/TSV word import parsing |
| `rateLimit.test.ts` | `rateLimit` / `sweepRateLimits` — uses `vi` fake timers (`beforeEach`/`afterEach`) plus a `_resetRateLimits` test hook |
| `strength.test.ts` | `wordStrength` scoring and `STRENGTH_META` labels |
| `studyScope.test.ts` | `parseQueueQuery` (limit resolution, scope parsing) and `scopeToWordWhere` Prisma where-clause building |
| `validation.test.ts` | Zod schemas (`feedbackSchema`, input length caps) |

### Unit tests — `src/lib/srs/__tests__/` (the certified scheduler baseline)

| File | Covers |
|---|---|
| `sm2.test.ts` | `SM2Algorithm`: initial state (EF 2.5, NEW, due now); table-driven first-review cases for quality 0–5 with exact EF/interval/reps/lapses/state; interval progression (reps 1→6 days, reps ≥2 → `round(prev * EF)`); EF floor 1.3; failure resets reps + counts a lapse; purity (input state not mutated) |
| `leitner.test.ts` | `LeitnerSystem`: box 1 initial state, `BOX_INTERVALS`, quality 0–5 box transitions, lapse counting |
| `modifiers.test.ts` | `applyUserModifiers` (`UserSRSPrefs`): intervalModifier, lapseModifier, masteryThresholdDays, fuzzIntervals — applied on top of raw algorithm output |

### E2E — `e2e/journey.spec.ts` (the only E2E file)

Serial suite (`test.describe.configure({ mode: "serial" })`) with 6 tests. It creates one throwaway account (`e2e-${Date.now()}@example.com`) and runs the full learner journey:

1. **Signup** → `/signup`, fill Email/Password, "Create account", land on `/dashboard`, see "Getting started".
2. **Enroll** → log in, `/lists`, open first list link (`a[href^='/lists/']:not([href$='/new'])`), click "Add all to my queue", assert the POST `/enroll` response is ok, dashboard shows a "Start" link.
3. **Study** → `/study?limit=3`, keyboard grading: Space×2 to reveal (term → phonetic → full), ArrowRight to grade, 700 ms waits for exit animation; assert "Session complete".
4. **Quiz mode** → `/study/quiz?limit=2`, "Pick the meaning", click an option, assert POST `/api/study/review` is ok.
5. **Guest mode** → `test("guest mode: one click to studying")`: from `/login`, click the "Try it as a guest" button, land on `/dashboard`, assert a "Start" link is visible (starter list auto-enrolled).
6. **Match mode** → `/study/match?limit=5`, assert "tap a word, then its meaning" renders.

Known pitfall documented in the spec itself: signup (`POST /api/auth/signup`) is rate-limited to 5/hour per source IP — rapid repeated local runs return 429; wait or restart the dev server. (The guest route `POST /api/auth/guest` has the same 5/hour/IP limit.)

## How to run

```powershell
npm test                                        # vitest run — full unit suite (~3s)
npx vitest run src/lib/srs/__tests__/sm2.test.ts  # single file
npx vitest                                      # watch mode
npm run test:e2e                                # playwright test (all of e2e/)
npm run build                                   # required green for any PR
```

Playwright config (`playwright.config.ts`, verified 2026-07-07):
- `testDir: ./e2e`, **chromium only**, `workers: 1`, `fullyParallel: false`, `retries: 0`, timeout 60 s.
- `webServer`: `npm run dev` on :3000 with `reuseExistingServer: true` — **if a dev server is already running, Playwright reuses it.** Pitfall: a long-running dev server can serve stale code after edits; restart it before trusting E2E results.
- `trace: "retain-on-failure"` — failed-test traces land in `test-results/`; open with `npx playwright show-trace <path-to-trace.zip>`.

## Evidence bar by change class

| Change class | Minimum evidence before merge |
|---|---|
| Scheduler (`src/lib/srs/*`) | Unit test asserting the exact new numeric schedule (intervals, EF, reps, dueAt) **and** a written justification against the algorithm spec (`srs-theory-reference`). No merge without both. |
| API route / input handling | Zod schema in `src/lib/validation` (or route-local) + a test in `src/lib/__tests__/validation.test.ts` (or a new file) exercising accept/reject cases. |
| User-journey change (flow, pages, study modes) | Extend `e2e/journey.spec.ts` to cover the new/changed step; full E2E run green. |
| UI-only (styling, copy, layout) | `npm run build` passes + manual/preview check. No new tests required. |
| Anything | `npm test` and `npm run build` green. |

## Acceptance discipline: never judge scheduling "by eye"

- Do not eyeball due dates in the UI or logs and call it correct. Assert exact intervals and dates in unit tests.
- **The fixed-clock pattern (used by all three SRS suites):** the algorithms take `now: Date` as a parameter — tests pin `const NOW = new Date("2026-01-01T00:00:00.000Z")`, pass it to `initialState(NOW)` and `calculateNextReview(state, quality, NOW)`, and assert with a `daysBetween(next.dueAt, NOW)` helper (`Math.round(diff / DAY_MS)`). Follow this pattern — no fake timers needed for scheduler code because time is injected.
- `rateLimit.test.ts` is the exception: `rateLimit` reads the real clock, so it uses `vi.useFakeTimers()` in `beforeEach` with cleanup in `afterEach`. Use that pattern only when the code under test does not accept an injected clock.
- Table-driven cases (`it.each`) for quality 0–5 are the house style for grading logic — cover the full quality range, not just the happy path.
- Fuzzed intervals (`fuzzIntervals` in modifiers) involve randomness: assert bounds/ranges, or test with fuzz disabled, per the existing `modifiers.test.ts` approach.

## Adding a unit test

1. Place the file in `src/lib/__tests__/` (general lib) or `src/lib/srs/__tests__/` (scheduler), named `<module>.test.ts`.
2. Vitest picks it up automatically — `vitest.config.ts` includes `src/**/*.{test,spec}.{ts,tsx}`, environment `node`, alias `@` → `./src` (so `import { x } from "@/lib/x"` works).
3. Run it in isolation first: `npx vitest run src/lib/__tests__/<file>.test.ts`, then the full `npm test`.

## Extending the E2E journey

- Add steps to `e2e/journey.spec.ts` (or a new `e2e/*.spec.ts`; `workers: 1` keeps runs serial across files, but the journey file itself relies on `mode: "serial"` and a shared account — new tests in that file must log in via the `logIn(page)` helper).
- Selector style: prefer role/label locators (`getByRole`, `getByLabel`, `getByText`); CSS selectors only where roles are ambiguous (see the list-link and quiz-option locators).
- Assert on network responses for mutations (`page.waitForResponse(... /enroll ... POST)`) rather than only on UI state.
- Pitfalls: signup rate limit (5/hour/IP → 429 on repeated runs); reused dev server serving stale code (restart `npm run dev` after code changes); throwaway accounts accumulate in the dev SQLite DB (harmless, but reseed if it bothers you).

## Golden / certified inventory

The existing 8 unit suites + the E2E journey **are** the certified baseline. Any change that alters their expected values (e.g., a new EF formula changing `sm2.test.ts` expectations) is by definition a scheduler/behavior change and must justify itself under `recall-change-control` — you may not silently update the assertions to match new output.

## Provenance and maintenance

Facts verified 2026-07-07 against the working tree (main @ e8f06ed). Re-verify with:

- Test file list: `ls src/lib/__tests__, src/lib/srs/__tests__, e2e`
- Suite status/count: `npm test` (was: 8 files, 96 tests, all passing)
- Scripts: `Get-Content package.json` (test = `vitest run`, test:e2e = `playwright test`)
- Vitest include/alias: `Get-Content vitest.config.ts`
- Playwright settings: `Get-Content playwright.config.ts`
