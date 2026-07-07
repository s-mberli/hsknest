---
name: recall-docs-and-writing
description: >
  Writing and maintaining Recall's docs of record and external positioning.
  Use when updating README.md or anything in docs/ (ARCHITECTURE.md,
  CONFIGURATION.md, DEPLOYMENT.md), writing release notes or roadmap entries,
  regenerating README screenshots (scripts/screenshots.mjs), answering
  licensing questions (AGPL-3.0, HSK MIT attribution), or deciding what Recall
  may claim vs competitors (Anki, HackChinese). Covers house style, doc
  templates, the change→doc matrix, and claims discipline.
---

# Recall: Docs and Writing

Recall is a self-hostable, AGPL-3.0 spaced-repetition vocabulary trainer
(Next.js + Prisma/SQLite), positioned as a privacy-first alternative to
Anki/HackChinese. This skill governs its documentation of record and every
externally visible claim.

## When NOT to use this skill

| Task | Use instead |
| --- | --- |
| Classifying/gating a code change, migration safety, review rules | `recall-change-control` |
| What the schema/SRS/queue actually do (code truth) | `recall-architecture-contract` |
| SRS theory (SM-2, Leitner, FSRS math) | `srs-theory-reference` |
| Env setup, install failures, build breakage | `recall-build-and-env` |
| Running/deploying/operating the app itself | `recall-run-and-operate` |
| Settings and env-var behavior in code | `recall-config-and-settings` |
| Debugging runtime bugs | `recall-debugging-playbook` |
| Test/QA strategy and running suites | `recall-validation-and-qa` |
| Inspecting a live instance | `recall-diagnostics-toolkit` |
| FSRS implementation work | `recall-fsrs-campaign` |
| Research/experiments | `recall-research-program` |

## Docs of record and their contracts

All paths relative to the repo root. The repo directory name contains a space — always quote paths in commands. (Original dev machine root: `C:\Users\mrks\Documents\claude project`, informational.)

| Doc | Contract (what it must stay true to) |
| --- | --- |
| `README.md` | Product pitch, screenshots, feature list, quick start, tests, project layout, license, **roadmap**. Every feature bullet maps to shipped code. |
| `docs/ARCHITECTURE.md` | Must track code: data model (`prisma/schema.prisma`), ownership rules (`src/lib/ownership.ts`), SRS strategy pattern (`src/lib/srs/`), queue & cap logic (`/api/study/queue`), request flow, strength display (`src/lib/strength.ts`). |
| `docs/CONFIGURATION.md` | Must track env vars (`.env.example`) and every per-user setting on the `User` model (theme, studyTheme, dailyNewWords, assumedCheckPerDay, preferredAlgorithm, intervalModifier, lapseModifier, masteryThresholdDays, fuzzIntervals, card text size), plus audio and feedback instructions. |
| `docs/DEPLOYMENT.md` | Must track `Dockerfile`, the container entrypoint (migrate → seed-once via `/data/.seeded` marker → `node server.js`), `docker-compose.yml`, Coolify flow, Caddy/HSTS, backups. |
| `CLAUDE.md` | Project constitution. Docs may never contradict it (language-agnostic schema, no hardcoded pinyin, SM-2 in `src/lib/srs.ts`-lineage, UI rules). |
| `.claude/skills/*/SKILL.md` | Skills are docs of record too. Each carries a Provenance section that must be kept fresh when its subject changes. |

### README roadmap structure (strict)

Three tiers under `## Roadmap`, in this order:

1. **Shipped (vX.Y ...):** a single dense paragraph of `·`-separated items —
   only things that exist in code and pass the E2E journey.
2. **Next (vX.Y):** a bulleted list of committed near-term work.
3. **Later (v1.0+):** a bulleted list of aspirational items.

When a feature ships: remove its bullet from **Next**, append it to the
**Shipped** paragraph (short `·` item), add a feature bullet to `## Features`
if user-facing, and update the Shipped version label if a release is cut.

## Change → doc matrix

| Code change | Update |
| --- | --- |
| `prisma/schema.prisma` (models/fields) | ARCHITECTURE.md "Data model"; CONFIGURATION.md if a `User` setting; README "SRS algorithm" if progress/log related |
| `src/lib/srs/*` (strategies, modifiers, registry) | ARCHITECTURE.md "SRS strategy pattern"; README "SRS algorithm" section; CONFIGURATION.md "Fine-tuning" if a knob changed |
| Study queue / cap logic (`/api/study/queue`, `src/lib/studyScope.ts`) | ARCHITECTURE.md "Queue & cap logic" |
| New/changed `User` setting or Settings-page control | CONFIGURATION.md "Account settings"; README Features bullet if notable |
| New/changed env var (`.env.example`) | CONFIGURATION.md env table; DEPLOYMENT.md env table if deploy-relevant |
| `Dockerfile`, entrypoint, `docker-compose.yml` | DEPLOYMENT.md; README "Deploy" short version if the two-liner changed |
| New user-facing feature | README Features bullet + roadmap move (Next → Shipped); screenshots if the UI changed visibly |
| Ownership/visibility rules (`src/lib/ownership.ts`) | ARCHITECTURE.md "Ownership & visibility"; CONFIGURATION.md "Content ownership" |
| New auth/security behavior | README "Accounts & auth" bullet; DEPLOYMENT.md security notes |
| Any of the above | The matching skill file's content + Provenance section |

## House style (derived from the actual docs, 2026-07-07)

- **Concise, imperative, no hype.** No "blazing fast", no superlatives. Plain
  claims a reader can verify.
- **Tables for option catalogs** — env vars, settings, doc contracts. Columns
  like Variable / Required / Example / Meaning.
- **README feature bullets are bold-lead:** `- **Feature name** — one to three
  lines of what it does`, em-dash after the bold lead, backticked field/code
  names inline.
- **Honest labeling of unshipped work:** anything not in code lives only under
  a roadmap heading ("Next"/"Later") or is explicitly marked "on the roadmap"
  in prose (e.g. CONFIGURATION.md's "A feedback admin dashboard is on the
  roadmap.").
- Doc pages open with a one-sentence scope line ("A concise tour of…",
  "A guide to self-hosting…").
- Cross-link between docs with relative Markdown links; bold the link text for
  primary pointers (`see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**`).
- Warnings as blockquotes (`> **Rotate any secret…**`); commands as fenced
  `bash` blocks that are copy-pasteable as-is.
- Wrap prose around ~80 columns, matching existing files.

## Screenshots

Captured by `scripts/screenshots.mjs` (Playwright, devDependency helper; never
runs in Docker). Output: `docs/screenshots/{dashboard,study,words,lists}.png`
at 1280×800, 2× device scale. The README embeds exactly these four.

Prereqs: a running, seeded server and an existing test account, plus
`npm i -D playwright && npx playwright install chromium` if not present.

```bash
# server already running on :3000 with a seeded test account
EMAIL=you@example.com PASSWORD=secret node scripts/screenshots.mjs
# non-default server:
BASE_URL=http://localhost:3001 EMAIL=... PASSWORD=... node scripts/screenshots.mjs
```

PowerShell equivalent: `$env:EMAIL='...'; $env:PASSWORD='...'; node scripts/screenshots.mjs`.

Regenerate whenever a screenshotted page changes visibly. To add a page,
extend the `PAGES` array in the script and add the image to the README tables.

## Templates

### New doc skeleton (`docs/NEWDOC.md`)

```markdown
# Title

One-sentence scope line: what this doc covers and for whom.

## Section

Prose or a table. Options go in tables; procedures go in numbered steps;
commands go in copy-pasteable fenced bash blocks.

## Related

See **[docs/OTHER.md](OTHER.md)** for adjacent topics.
```

Then link it from README's Configuration/Deploy area and the "Project layout"
tree.

### Roadmap entry

- Next/Later bullet: `- Short feature name — one clause of concrete scope
  (constraints or design notes in parentheses)`
- Shipped item: 2–6 words, `·`-separated, appended to the Shipped paragraph.

### README feature bullet

```markdown
- **Feature name** — what the user can do, in one to three lines; backtick
  field names (`metadata`) and note the boundary of the feature honestly.
```

## External positioning and claims discipline

**May claim as shipped facts (verified in code as of 2026-07-07):**
self-hosted (Docker/compose, AGPL); fully on-device pronunciation audio (Web
Speech API, no cloud/API key); language-agnostic schema (`term`/`translation`/
`phonetic`/`metadata`); selectable scheduling algorithms (SM-2 + Leitner,
per-account, lossless switching); tunable schedule; CSV import/export;
practice modes (quiz + matching); guest mode (one-click throwaway account,
`POST /api/auth/guest`, E2E-covered in `e2e/journey.spec.ts`); HSK 1–6
content; Playwright E2E suite.

**Must NOT claim as existing (roadmap only):** FSRS; analytics/heatmaps;
PostgreSQL support (README says "swap to Postgres" — keep it framed as a
manual provider change, not a supported toggle); PWA/offline; email
verification/password reset; BYO-key TTS/image generation; shared/public user
lists; feedback admin UI; hosted instance.

Rules:

1. Every user-facing claim in README maps to shipped code **and** passes the
   E2E journey (`npm run test:e2e`). If the E2E suite doesn't exercise it,
   either extend the suite or soften the claim.
2. Comparisons to Anki/HackChinese stay factual and feature-based — no
   disparagement, no speculative superiority claims.
3. Unshipped work is only ever described under roadmap headings or with an
   explicit "on the roadmap" label.
4. Docs may not contradict `CLAUDE.md` (the constitution): language-agnostic
   schema, no hardcoded pinyin fields, SM-2 as core algorithm, mobile-first UI.

**Known repo-doc bug (2026-07-07):** `docs/CONFIGURATION.md` states the
`studyTheme` default as `dark`, but `prisma/schema.prisma` says
`@default("follow")`. Code wins — fix the doc via a normal docs PR.

## License duties

- **AGPL-3.0** (`LICENSE`): self-hosting is free; anyone offering a modified
  Recall as a network service must share their modifications. State this
  plainly wherever licensing comes up; never soften it to "MIT-like".
- **HSK data attribution** (`prisma/data/hsk/README.md`): the HSK 1–6 JSON is
  derived from `complete-hsk-vocabulary` by Yanis Zafirópulos, MIT License.
  That README and the attribution in the main README's License section must be
  preserved through any data refactor.

## Provenance and maintenance

Facts verified against the working tree on **2026-07-07** (commit `e8f06ed`).
Re-verify before relying on volatile details:

- Roadmap tiers & feature bullets: `Read README.md` (Features ~L25, Roadmap ~L184)
- Doc contracts: `Read docs/ARCHITECTURE.md docs/CONFIGURATION.md docs/DEPLOYMENT.md`
- Screenshot pages/output dir: `Read scripts/screenshots.mjs` (PAGES array, OUT_DIR → `docs/screenshots/`)
- Settings list: `grep -n "theme\|daily\|Modifier\|mastery\|fuzz" prisma/schema.prisma`
- HSK attribution intact: `Read prisma/data/hsk/README.md`
- License: `head -5 LICENSE`
- Constitution: `Read CLAUDE.md`
