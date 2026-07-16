---
name: recall-build-and-env
description: >
  Recreate the HSK Nest dev environment from scratch and fix environment/install
  problems. Use when: setting up a fresh clone; npm install fails; .env is
  missing or wrong (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL); prisma
  migrate/seed fails locally; SQLite "database is locked" or Prisma engine
  errors on Windows; EPERM on .next or node_modules; npm run build breaks;
  Playwright browsers are missing; or you need to verify the environment is
  healthy before other work.
---

# HSK Nest — Build & Environment Runbook

Facts verified against the repo on **2026-07-07**. The repo directory name contains a **space** — always quote paths in commands and scripts. Commands below use relative paths from the repo root. (Original dev machine root: `C:\Users\mrks\Documents\claude project`, informational only.)

## When NOT to use this skill

| You want to… | Use instead |
| --- | --- |
| Run the dev server day-to-day, deploy, Docker/Coolify ops | `recall-run-and-operate` |
| Debug application bugs (SRS logic, API, UI) | `recall-debugging-playbook` |
| Change env vars' meaning / per-account settings | `recall-config-and-settings` |
| Decide whether a change (esp. schema/migration) is allowed | `recall-change-control` |
| Run/extend tests and QA | `recall-validation-and-qa` |

Other siblings: `recall-architecture-contract`, `srs-theory-reference`,
`recall-diagnostics-toolkit`, `recall-docs-and-writing`, `recall-fsrs-campaign`,
`recall-research-program`.

## 1. Prerequisites

- **Node.js 18+, Node 22 recommended** (per README Quick start). Original dev machine (informational): Node 24.15.0 / npm 11.12.1 as of 2026-07-07 — works fine.
- Original dev machine (informational): Windows 10 with **both PowerShell and Git Bash** available; Windows-specific traps below apply there.
- Key dependency majors as of 2026-07-07 (from `package.json`): Next **16.2.10**, React **19.2.4**, Prisma **^6.19.3**, NextAuth **^4.24.14** (v4, not v5), Zod **^4**, Tailwind **^4**, Vitest **^4**, Playwright **^1.61**, tsx **^4** (runs the seed).

```powershell
node --version   # expect >= 18
# from the repo root (quote the path if it contains a space)
npm install
```

## 2. Environment file

Copy `.env.example` → `.env` and fill in three variables:

| Variable | Local value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite file, resolved **relative to `prisma/`** (Prisma convention) → `prisma/dev.db`. Prod is also SQLite: `file:/data/recall.db` on the persistent `/data` volume (see `recall-run-and-operate`); prod applies migrations with `prisma migrate deploy`, never `migrate dev`. Postgres is a documented-but-unexercised future path gated by `recall-change-control`. |
| `NEXTAUTH_SECRET` | 32+ random bytes, base64 | Signs NextAuth JWT sessions. |
| `NEXTAUTH_URL` | `http://localhost:3000` | Canonical base URL; must match the real URL in deployments. |

Generate the secret:

```bash
# Git Bash (openssl ships with Git for Windows)
openssl rand -base64 32
```

```powershell
# PowerShell alternative (no openssl needed)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Copy the file:

```powershell
Copy-Item .env.example .env   # then edit .env
```

## 3. Database bootstrap

```powershell
npm run db:migrate   # = prisma migrate dev — creates prisma/dev.db, applies all migrations
npm run db:seed      # = prisma db seed → tsx prisma/seed.ts
```

Migrations live in `prisma/migrations/` — 8 migration directories + `migration_lock.toml` as of 2026-07-07 (`20260705111552_init` → `20260706153715_phase11_card_text_size`). `migration_lock.toml` pins the provider.

### What the seed does (verified against `prisma/seed.ts`)

1. Removes a retired list ("Everyday Mandarin Starter", seeded lists have `createdById: null`), manually clearing `ReviewLog` rows first because ReviewLog has no FK to Word.
2. Upserts languages `zh` (Mandarin Chinese) and `es` (Spanish) by `code`.
3. Seeds public word lists: **HSK 1–6** (loaded from `prisma/data/hsk/hsk{1..6}.json`), plus inline "Everyday Conversations", "Reading the News" (zh), and "Everyday Spanish Starter" (es).

**Idempotency: yes, at the list level.** `seedList()` skips creation if a list with the same `(languageId, name)` already exists; languages are upserted; the retired-list removal no-ops when absent. Safe to re-run. Caveat: it does **not** update the words inside an existing list — to refresh seeded content you must delete the list (or the DB) first.

## 4. Build & typecheck

```powershell
npm run build   # = next build; this is also the project's typecheck gate (no separate lint/typecheck script)
```

- `next.config.ts` sets `output: "standalone"` — build emits `.next/standalone` for the Docker image — and adds baseline security headers (no CSP/HSTS; HSTS belongs on the proxy).
- `tsconfig.json`: `strict: true`, `noEmit`, `moduleResolution: "bundler"`, path alias `@/* → ./src/*`. Vitest and Playwright files are included in the program (`**/*.ts`), so type errors in tests fail the build's typecheck.

## 5. Windows-specific traps

**Confirmed by repo/platform facts:**

- **Path with a space**: the repo folder is `claude project`. Always quote paths in commands and scripts; unquoted paths silently break some tools.
- **SQLite is a single local file** (`prisma/dev.db`, marked `binary` in `.gitattributes`). SQLite locks the whole file on write — running `next dev` + `prisma studio` + `prisma migrate dev` simultaneously can yield "database is locked" or migrate hanging. **Stop the dev server (and Studio) before running `npm run db:migrate`.** `migrate reset` also wants exclusive access.
- **Line endings**: `.gitattributes` sets `* text=auto` with `*.sh` and `Dockerfile` forced to **LF** (required for Docker/Alpine). Don't override with `core.autocrlf=false` edits to these files; if a shell script fails in Docker with `\r` errors, re-checkout with the attributes applied: `git rm --cached -r . ; git reset --hard` (destructive — only on a clean tree).

**Watch for (plausible, not reproduced in this repo):**

- **EPERM / EBUSY on `.next` or `node_modules`**: usually an antivirus scan, Explorer/editor holding a handle, or a still-running `node.exe`. Fix: kill stray node processes (`Get-Process node | Stop-Process -Force -Confirm:$false`), then delete `.next` and rebuild.
- **Prisma engines on Windows**: the query engine DLL (`node_modules\.prisma\client\*.dll.node`) can be locked by a running dev server, making `prisma generate` (which `migrate dev` runs) fail with EPERM. Stop node processes, retry; if corrupted, delete `node_modules\.prisma` and run `npx prisma generate`. Corporate proxies can also block the engine download on first install.

## 6. Playwright browsers (needed for e2e)

```powershell
npx playwright install chromium
```

Without this, `npm run test:e2e` fails with "Executable doesn't exist". Note the repo uses the `playwright` package (not `@playwright/test` — it re-exports the runner via `playwright test`).

## 7. Verification checklist

Run in order from the repo root; all must pass.

| # | Command | Healthy result |
| --- | --- | --- |
| 1 | `node --version` | v18+ |
| 2 | `Test-Path .env` | `True`, with the 3 vars set |
| 3 | `npx prisma migrate status` | "Database schema is up to date" |
| 4 | `npm run db:seed` | "Seed complete." (idempotent, safe to re-run) |
| 5 | `npm test` | Vitest suite passes (SRS, import parser, validation, rate limiter) |
| 6 | `npm run build` | Builds clean, emits `.next/standalone` |
| 7 | `npm run dev` then open http://localhost:3000 | Login/landing page renders |
| 8 | (optional) `npm run test:e2e` | Playwright suite passes (needs step 6 browsers + free port 3000) |

Quick page check while dev server runs:

```powershell
(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).StatusCode   # expect 200
```

## Provenance and maintenance

Verified 2026-07-07. Re-verify with:

- Scripts & dep versions: `Get-Content package.json`
- Env vars: `Get-Content .env.example`
- Seed behavior/idempotency: read `prisma/seed.ts`
- Migration list: `Get-ChildItem prisma/migrations`
- Standalone output & headers: `Get-Content next.config.ts`
- tsconfig strictness/paths: `Get-Content tsconfig.json`
- Line-ending rules: `Get-Content .gitattributes`
- Quick-start drift: README.md "Quick start" section
