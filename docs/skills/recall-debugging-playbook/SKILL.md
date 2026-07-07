---
name: recall-debugging-playbook
description: Symptom-first triage playbook for any bug, error message, test failure, or unexpected behavior in the Recall SRS app — 401s or login/session failures, NextAuth/NEXTAUTH_SECRET misconfig, Prisma/SQLite errors on Windows (locked database, migrate drift, EPERM, seed issues), scheduler/queue surprises — an interval or queue result you believe is a BUG (word not appearing, daily caps, wrong intervals, timezone/calendar-day confusion) — and Playwright/Vitest failures. Load whenever something is broken, failing, or behaving unexpectedly and you need to figure out why. (To merely measure/reproduce intervals numerically use recall-diagnostics-toolkit; for the theory behind an interval use srs-theory-reference.)
---

# Recall Debugging Playbook

Symptom → cause → discriminating experiment, grounded in this repo's actual code. Facts verified against source on 2026-07-07.

**Jargon, defined once:**
- **SRS**: spaced-repetition scheduling. Card states here: `NEW`, `LEARNING`, `REVIEW`, `LAPSED`, `ASSUMED` (marked already-known, awaiting a verification check), `MASTERED`. Note: `LAPSED` exists in the enum but is never written by either scheduler — see `srs-theory-reference` §7.
- **Queue route**: `src/app/api/study/queue/route.ts` — builds the study session: due reviews first, then assumed checks, then new cards, capped per calendar day.
- **Discriminating experiment**: the single probe that tells the ranked causes apart. Run it before editing anything.

## When NOT to use this skill

- **Install/dependency/node/Next build environment problems** → `recall-build-and-env`.
- **You need a measurement/inspection script** (dump a user's queue state, count due cards) → `recall-diagnostics-toolkit`.
- **Deciding whether a fix is actually done / what tests must pass** → `recall-validation-and-qa`.
- **Before changing schema, migrations, or `src/lib/srs/*`** → `recall-change-control` (mandatory gate).

---

## 1. Auth / session failures

Key files: `src/lib/auth.ts` (NextAuth options, JWT strategy, credentials provider), `src/lib/session.ts` (`getCurrentUserId()`), `src/lib/rateLimit.ts`.

| Symptom | Likely causes (ranked) | Discriminating experiment | Fix pointer |
|---|---|---|---|
| API returns `{"error":"Unauthorized"}` with 401, but you can browse pages | 1. Missing/expired session cookie in the API call (curl/fetch without cookies). 2. `session.user.id` missing because JWT callback didn't run (stale token signed under a different `NEXTAUTH_SECRET`). 3. User row deleted — queue route re-checks `prisma.user.findUnique` and 401s even with a valid session. | In browser devtools, call the API from the app's own page: `fetch('/api/study/queue').then(r=>r.status)`. 200 there but 401 from curl = cookie problem, not server. If 401 in-browser too, check `fetch('/api/auth/session').then(r=>r.json())` — empty object = no/invalid JWT; object without `user.id` = callback/secret issue; object with id = deleted-user case. | Every API route gates via `getCurrentUserId()` returning null → 401 (`src/lib/session.ts`). Pages redirect instead. Re-login to mint a fresh token; verify the `jwt`/`session` callbacks in `src/lib/auth.ts` still copy `token.id` → `session.user.id`. |
| All logins fail with generic "sign in failed", correct password | 1. **Rate limiter lockout**: `authorize()` returns null after 10 attempts/min per normalized email (`rateLimit(\`login:${email}\`, 10, 60*1000)` in `src/lib/auth.ts`). 2. Email case mismatch in DB (authorize lowercases input; a seeded/registered mixed-case email never matches). 3. bcrypt hash mismatch (password changed out of band). | Wait 60s (fixed window) and retry once. Immediate success = rate limit. Still failing: the limiter is **in-memory per process — restarting the dev server clears it** (`src/lib/rateLimit.ts`, Map in module scope). If restart doesn't help, check the row: `npx prisma studio` → User → compare stored email casing to what you type. | NextAuth deliberately surfaces a generic failure for null from `authorize()` — the code comments say so. Don't hunt for a specific "locked out" message; it doesn't exist. |
| Login "succeeds" then immediately bounced back to `/login`; or session randomly invalid after a deploy | 1. `NEXTAUTH_SECRET` changed/unset — existing JWTs fail to decrypt, session silently empty. 2. `NEXTAUTH_URL` wrong (prod behind proxy / different port) — callback redirects go to the wrong origin, cookie set on wrong host. | Check server logs for NextAuth `[next-auth][error] JWT_SESSION_ERROR` / `NO_SECRET` warnings. Compare: does `/api/auth/session` return `{}` while the cookie `next-auth.session-token` exists in devtools? Yes = secret mismatch. Redirected to an unexpected host/port after login = `NEXTAUTH_URL`. | `authOptions.secret = process.env.NEXTAUTH_SECRET`, strategy `"jwt"`, maxAge 30 days (`src/lib/auth.ts`). Set both env vars; changing the secret invalidates every session by design — users must re-login. |
| Rate-limit behavior differs between dev and prod, or "limit never resets" in tests | Limiter is a module-scope `Map`; fixed window, lazy reset (`src/lib/rateLimit.ts`). Multiple instances = per-instance limits. Tests leaking state across cases. | In tests, import and call `_resetRateLimits()` between cases (exported for exactly this). In prod, confirm single instance — the file's own comment says swap for Redis if you scale out. | `src/lib/rateLimit.ts` — `rateLimit()`, `sweepRateLimits()`, `_resetRateLimits()`. |

---

## 2. Prisma / SQLite on Windows

DB is SQLite via `DATABASE_URL` (`prisma/schema.prisma`). The repo directory name contains a **space** — always quote paths in shell commands; use relative paths from the repo root. (Original dev machine: Windows 10, root `C:\Users\mrks\Documents\claude project`, informational.)

| Symptom | Likely causes (ranked) | Discriminating experiment | Fix pointer |
|---|---|---|---|
| `Error: SQLite database is locked` / `database is locked` during migrate or writes | 1. Dev server + `prisma studio` (or `migrate dev`) open concurrently — SQLite allows one writer. 2. A crashed process holding the file handle. 3. Antivirus/indexer scanning the `.db` file (Windows-specific). | Close Studio and stop `npm run dev`, retry the command alone. Works = concurrency. Still locked = orphan process: `Get-Process node | Stop-Process` (PowerShell), or check for a `dev.db-journal`/`-wal` file next to the db. | Run migrations with everything else stopped. On Windows, exclude the db directory from real-time AV scanning if it recurs. |
| `migrate dev` warns about drift / wants to reset; or prod container fails on startup migration | 1. Ran `migrate dev` where you should run **`migrate deploy`** (prod/Docker): `migrate dev` generates migrations and can reset; `deploy` only applies existing ones. 2. Schema edited without a migration (drift). 3. Db file was created by `db push` or an older migration set. | `npx prisma migrate status` — tells you exactly which migrations are unapplied vs. drifted, no side effects. | Dev: `npm run db:migrate` (`prisma migrate dev`). Prod: `prisma migrate deploy` only. If dev db is disposable, `prisma migrate reset` then `npm run db:seed`. Never `reset` against real data — see `recall-change-control`. |
| Unsure if re-running the seed is safe / duplicates feared | Seed is **idempotent by list name**: `seedList()` in `prisma/seed.ts` skips if a `WordList` with that name exists for the language; languages are upserted; it also *deletes* the retired list "Everyday Mandarin Starter" (`removeSeededList`) on every run. | Re-run `npm run db:seed` and count lists before/after in Studio — counts stable. | Safe to re-run (verified 2026-07-07). Caveat: it will NOT update words inside an existing list — to refresh a seeded list's content, delete the list first. |
| `EPERM: operation not permitted` on `.next\...` or `query_engine-windows.dll.node` during dev/build | 1. Windows file lock: dev server still running while `next build` / `prisma generate` runs. 2. `.next` corrupted by a killed process. | Stop all node processes, then `Remove-Item -Recurse -Force .next` and retry. If `prisma generate` fails on the DLL, the dev server has the engine loaded — stop it first. | Classic Windows lock, not a code bug. Don't chase it in application code. |
| Shell command fails weirdly, path truncated mid-directory-name | Repo dir name has a space. | Re-run with the repo path quoted (e.g. `cd "<repo root>"`). | Quote every path argument in scripts and npm hooks; prefer relative paths from the repo root. |

---

## 3. Scheduler / queue bugs

Walk `src/app/api/study/queue/route.ts` before theorizing. Order of assembly: (1) due reviews (`dueAt <= now`, states LEARNING/REVIEW/LAPSED) — never blocked by caps; (2) assumed checks (state ASSUMED, capped by `assumedCheckPerDay` minus checks already done today); (3) new cards (state NEW, capped by `dailyNewWords` minus introductions today). All three respect the `limit` query param and scope filter — **except the cap counters, which are intentionally global** (unscoped) to prevent double-spending caps across differently-scoped sessions (comment at route.ts:51-54).

**How "today" is computed — the known trap:** `startOfLocalDay(now)` in `src/lib/utils.ts` does `d.setHours(0,0,0,0)` — that is **the server process's local timezone**, not UTC and not the user's browser timezone. On the Windows dev box "today" is your local midnight; in a Docker container it is the container's TZ (usually UTC unless `TZ` is set). A user in another timezone gets caps that reset at the *server's* midnight. Verified 2026-07-07.

| Symptom | Likely causes (ranked) | Discriminating experiment | Fix pointer |
|---|---|---|---|
| A word I expect to study doesn't appear in the queue | 1. Daily cap exhausted (`newAllowedToday` or `checksAllowedToday` hit 0). 2. Scope filter excludes its list (`scopeToWordWhere` in `src/lib/studyScope.ts`). 3. Not due yet (`dueAt` in the future) or state is `MASTERED` (never queried). 4. `limit` reached — due reviews crowd out checks/new. | Hit the endpoint raw and read the counters it already returns: `fetch('/api/study/queue?limit=200').then(r=>r.json())` → inspect `counts.newAllowedToday` / `counts.checksAllowedToday` (0 = cap) and whether the card appears with a big limit and no scope (appears = scope/limit; absent = dueAt/state). Then check the row in Studio: `UserProgress.state`, `dueAt`, `introducedAt`. | Route logic at `src/app/api/study/queue/route.ts:36-96`. Caps stamp fields at grade time in the review route: `introducedAt` (new-word spend), `assumedCheckedAt` (check spend). |
| Caps reset at a weird hour / "did my reviews yesterday but cap still spent" | Server-local midnight, per `startOfLocalDay` above. Docker default TZ=UTC vs dev machine local time. | Compare `date` inside the prod container vs your wall clock; or log `new Date().getTimezoneOffset()` server-side. Offset differs from expectation = TZ mismatch, not a logic bug. | Set `TZ` in the container to the intended timezone, or accept server-midnight semantics. **Warning:** changing `TZ` on a live instance shifts cap-reset timing for every user — it is a scheduler-behavior change and must go through `recall-change-control`, like any change to day-boundary logic. |
| Interval after a review "looks wrong" (too long/short, not matching raw SM-2) | 1. **Modifier layer**: `applyUserModifiers` in `src/lib/srs/modifiers.ts` multiplies success intervals by `intervalModifier`, sets lapse interval to `max(1, prevInterval * lapseModifier)`, and applies ±5% fuzz when `fuzzIntervals` and interval ≥ 2 days. 2. Mastery cutoff: interval ≥ `masteryThresholdDays` flips state to `MASTERED` (card leaves the queue — often mistaken for a lost card). 3. Actual algorithm bug in `src/lib/srs/` (e.g. `sm2.ts`, `leitner.ts`). | Check the user's prefs first (Studio → User: intervalModifier, lapseModifier, fuzzIntervals, masteryThresholdDays). Then reproduce deterministically: `applyUserModifiers` takes an injectable `rng` — call it in a vitest with `rng: () => 0.5` and compare. Matches expected with modifiers accounted for = not a bug. | Modifiers are a pure post-processor over the strategy result; `dueAt = now + adjusted intervalDays`. Small drift on ≥2-day intervals is the fuzz working as designed. Canonical modifier semantics: `srs-theory-reference` §6. |
| Assumed-known word suddenly shows up as a card | Working as designed: ASSUMED cards are drip-fed as "checks" at `assumedCheckPerDay` per day, ordered by word position. | `counts.checksAllowedToday` > 0 and card `kind === "check"` in the queue response confirms it. | route.ts:74-84. |
| Quiz mode has missing/duplicate answer choices | Distractor pool is other studied words in the same language (≤400, deduped translations); fewer than 3 available = fewer options. | Count distinct translations the user studies in that language. | route.ts:122-155 (`?choices=1`). |

---

## 4. Test failures (Playwright / Vitest)

| Symptom | Likely causes (ranked) | Discriminating experiment | Fix pointer |
|---|---|---|---|
| E2E tests fail against behavior you just fixed; code changes "don't take" | **Playwright reuses any server already on :3000** (`playwright.config.ts`: `reuseExistingServer: true`). A stale dev server = stale code, stale env vars, stale in-memory rate-limit state. | Kill everything on :3000 (`Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.OwningProcess }`) and re-run `npm run test:e2e` so Playwright starts a fresh `npm run dev`. Passes now = stale server. | Restart the dev server after env or server-code changes before trusting E2E results. |
| E2E login tests flake after several runs | Rate limiter: 10 login attempts/min per email, in-memory. Repeated E2E runs against a long-lived dev server accumulate attempts. | Restart the dev server (clears the Map) and re-run. | See section 1; tests can also use distinct emails per run. |
| Vitest test touching DOM/browser APIs fails with `document is not defined` | Vitest runs in **node** environment (`vitest.config.ts: environment: "node"`); unit tests here are for pure logic (`src/**/*.{test,spec}.ts`). | It's the config, not the code — confirm by reading `vitest.config.ts`. | Keep component testing in Playwright E2E; unit-test pure functions (srs, modifiers, rateLimit — note `_resetRateLimits()` between cases). |
| E2E timing out at startup | `webServer.timeout` is 120s; cold Next dev compile on Windows can approach it, especially first run. | Pre-warm: start `npm run dev` manually, wait for ready, then run tests (reuse kicks in — but see stale-server row). | playwright.config.ts. |

---

## 5. Settled battles (do not re-fight)

Git history is only 3 squashed commits, so evidence comes from migration names and docs. **Inference is labeled as such.**

- `20260705224505_phase2_assumed_fix` — *inference*: the assumed-words feature (ASSUMED state / `assumedCheckedAt` / `assumedCheckPerDay`) shipped in `phase2` and needed a schema fix the same day. The current route deliberately counts checks "regardless of the state they landed in after the check" and keeps cap counters unscoped (route.ts comments) — these read like hard-won invariants. Don't "simplify" them.
- `20260706034043_phase5_ownership` — *inference*: list ownership (`createdById`, seeded lists have `createdById: null`) was retrofitted; `removeSeededList` filters on `createdById: null` to avoid deleting user lists. Preserve that filter.
- `20260706054213_phase6_study_theme` + `20260706083606_phase7_study_theme_follow` — *inference*: theming needed a follow-up migration; theme-related schema is settled.
- Seed once shipped an "Everyday Mandarin Starter" list, now actively deleted on every seed run (`prisma/seed.ts` `removeSeededList`) — including a manual `ReviewLog` cleanup because ReviewLog has no FK to Word. Fact from code, 2026-07-07. Don't re-add a list by that name.
- **Login** rate limiting is intentionally per-email, not per-IP — NextAuth v4 `authorize()` exposes no reliable IP (comment in `src/lib/auth.ts`). Fact. Don't "fix" it to per-IP without a real IP source. This is login-only: `POST /api/auth/signup` and `POST /api/auth/guest` ARE rate-limited per-IP (5/hour, via `x-forwarded-for`).

---

## Provenance and maintenance

Re-verify before trusting a row (one-liners, run from repo root, quote the path):

- Queue/cap logic: `Read src/app/api/study/queue/route.ts` and `grep -n "startOfLocalDay" src/lib/utils.ts` (confirms local-vs-UTC day boundary).
- Auth/limiter: `Read src/lib/auth.ts src/lib/session.ts src/lib/rateLimit.ts`.
- Seed idempotency: `Read prisma/seed.ts` (look for the `findFirst` skip in `seedList`).
- Migration history: `ls prisma/migrations`.
- Test harness: `Read playwright.config.ts vitest.config.ts` (`reuseExistingServer`, `environment: "node"`).

All quoted behavior verified against source on 2026-07-07. If any of these files changed since, re-read them before applying this playbook.
