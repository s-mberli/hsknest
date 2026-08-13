# HSK Nest Releases

Work-in-progress tracking for releases and roadmap. **Unreleased** items are confirmed bugs or planned features under active consideration. **Someday** is a flexible pool of ideas with no commitment — nothing there is slated or scoped.

Solo dev: no GitHub-issues overhead, no artificial milestones. Items move up when done; this file is the single source of truth.

---

## Unreleased (next)

## v0.2.3

**Security / self-host:**
- ✅ Self-hosted instances now close registration after the first account signs
  up (it claims the instance) — previously signup and guest mode were fully
  open, so any network-reachable container handed out free, permanent
  full-access accounts to anyone. Guest mode ("Just looking? Try it as a
  guest") is now hosted-only. `ALLOW_REGISTRATION=true` reopens both. See
  `src/lib/registration.ts` and `docs/CONFIGURATION.md`.

### Known limitation (not fixed, documented, not blocking)

- **着 TTS mispronunciation** — spoken as "zháo" instead of "zhe" (aspect particle). Checked edge-tts's source this release: it escapes all input text before wrapping in SSML, so there's no way to inject a `<phoneme>` override through the public API. A real fix needs either reverse-engineering the library's private internals or hand-rolling Azure's WebSocket protocol — deferred as genuinely non-trivial, not a quick patch.

---

## v0.2.2 — 2026-08-13

MVP polish batch: Docker/self-host fixes, UI cleanup, data-quality pass across the full HSK vocabulary + sentences (2 rounds of external cross-check + 4 real production user reports), and B8 production audio verification.

**Docker / self-host:**
- ✅ **B1.** `docker-entrypoint.sh` generates + persists `NEXTAUTH_SECRET` if unset (survives restarts); defaults `AUTO_SEED=true`. `docker run` now boots working out of the box — previously hit `NO_SECRET` → `CLIENT_FETCH_ERROR`. Added `docker run` quick-start docs to README.
- ✅ **B2.** Self-hosters redirect `/` → `/login` (or `/signup` if zero users exist — fresh instance starts at signup, not login). No longer shows the marketing landing page.
- ✅ Email verification nudge banner hidden on self-hosted instances (users typically haven't configured Resend, so the "verify" link is unreachable; nagging them is confusing, not helpful).
- ✅ Verified end-to-end: full `docker build` + local run, confirmed boot succeeds; zero-user instance correctly routes to `/signup`.

**UI / UX:**
- ✅ **B4.** Expanded `POS_LABELS` to all 36 ICTCLAS codes (was leaking raw codes like "g"/"f"/"b" — confirmed by a real user report on 后). Removed `CookieBanner.tsx` entirely (Umami is cookieless, no functional consent gate existed).
- ✅ **B5.** Font-switch setting now calls `router.refresh()` after saving; `--font-serif` defined with a real CJK-capable font stack.
- ✅ **B6.** Billing section moved to the top of the Account tab.
- ✅ **C1.** Speaker (pronunciation) buttons added to list-view word tables.
- ✅ **C2.** `public/llms.txt` added for AI/answer-engine discoverability.

**Backend:**
- ✅ **B7.** Upgrade-confirmation email sent on successful Stripe checkout.
- ✅ **B3.** Sentence-to-word linkage fix — `sentenceBuild.ts` drops weak single-character links that are substrings of a longer co-present term, preventing common characters (like 中) from being linked only to unrelated/rare-sense sentences. Confirmed by a real production user report.
- ✅ **B8.** Verified production audio config: `https://hsknest.com/audio/zh/w/<hash>.mp3` for 是 returns `200 OK` with correct content-length. The pre-generated clip is being served correctly — whatever caused the reported browser-TTS fallback was a one-off client-side condition (autoplay policy, network blip), not a server misconfiguration.

**Data quality (HSK vocabulary + sentences):**
- ✅ Fixed 8 empty translations at HSK5–7 (效仿, 无可厚非, 纯朴, 抑扬顿挫, 得意扬扬, 做证, 下功夫, 纪录).
- ✅ Reordered primary sense for 14 words where an archaic/rare meaning was shown first instead of the common modern one (老, 卡, 故事, 封, 咸, 轿车, 钟, 大方, 生意, 等, 告诉, 药, 考, 后, 被) — several confirmed by real user reports (后, 被) or CC-CEDICT cross-reference.
- ✅ Fixed 2 mistranslated example sentences (果断 → was mapped to "procrastinate"; 熄火 → literal "put out fire" instead of common "turn off the engine").
- ✅ Full review of German (310 entries) and Chinese-themed starter lists (76 entries) — both came back clean.
- ✅ New tooling: `check-hsk-data-quality.ts`, `check-primary-sense-order.ts`, `check-sentence-quality.ts`, `export-for-gemini-review.ts`, `export-more-for-gemini.ts`, `export-hsk-data.ts` — reusable for future data audits.
- ✅ Checked production `/mb-admin` feedback via SSH: 4 real user word reports found, 3 root-caused and fixed in code this release (中, 后, 被), 1 documented as a known limitation (着). All 4 marked closed.

**Tracking:**
- ✅ `RELEASES.md` created — replaces the README's inline roadmap section as the source of truth for what's shipping and what's under consideration.

**Verification:** `npm test` 335/335, `tsc --noEmit` clean, `npm run lint` 0 errors, `npm run build` clean, `npm run test:e2e` 26/26 (after signup/verify-banner fixes), full `docker build` + fresh zero-user instance boot verified end-to-end.

---

## v0.2 — 2026-07-??

- Deeper sentence coverage from Tatoeba corpus (22%→X% HSK5, 6%→X% HSK7-9)
- Triage Mode anti-churn recovery sessions
- The Efficiency Receipt (post-session FSRS retention predictions)
- Descending Retrievability Sorting (easiest-first during catch-up)
- Advanced Stability Dashboards (memory half-life visualization)

---

## v0.1 MVP — Shipped

Multi-language schema · FSRS scheduling · gesture-first study deck · daily caps + session sizing · algorithm tuning · word-strength browser · focus dashboard + 7-day forecast · CSV import · user-created lists & words · Light/Dark/System theme + focus mode · study-scope filtering · graded HSK lists · progress reset · on-device pronunciation · rate limits + security hardening · in-app feedback · Docker + compose self-host · quiz/matching practice modes · card text sizing · E2E tests · guest mode with upgrade · CC-CEDICT entry assist · session summary · email auth + password reset · full HSK 1–9 decks · 3,000 Tatoeba sentences · sentence-practice mode · new-word preview · HSK-level onboarding · Stripe billing (self-host bypass) · Umami analytics · error tracking · list priority queue · lifetime stats · hybrid TTS (Azure neural + Web Speech) · keyboard shortcuts · smart hotkey nudges · engagement-decline emails · post-cancellation survey.

---

## Someday / Under Consideration

These are flexible ideas with zero commitment. No timeline, no scope. Listed here so they're not forgotten.

- **Graded reading / story mode** — Read a passage, hover any word for gloss + reading, tap to add to study deck. Reuses sentence + audio infra.
- **Grammar lessons** — Structure explanations per HSK level, sitting alongside vocabulary (not replacing it).
- **"Skip this word" suppression** — Mark a word "don't want to learn this" without marking it known. Behaves like a strong interval bump; state stays distinct from mastered. Lives next to the existing flag icon.
- **Advanced deck statistics** — Per-word progress analytics, forgetting curves, optimal review timing predictions.
- **Mobile app** — React Native or similar cross-platform wrapper around the API (longer-term).
- **Spaced-repetition algorithm research** — FSRS tuning, Leitner + FSRS hybrid, comparison studies against SM-2.
- **Multi-platform sync** — Sync progress across devices automatically (needs a backend change).
- **Community decks & sharing** — Export + import user-created lists; community library of curated decks.
- **Anki bridge** — Import .apkg decks, export to .apkg format for Anki desktop.
- **Prisma 7 migration** — closed as unmergeable PRs #16/#13 (2026-08-13): `prisma generate` fails with `P1012` (schema `url` no longer supported) and a client/CLI version mismatch when taken separately — they're one migration, not two independent bumps. Also requires: `prisma.config.ts` + explicit driver adapter, converting the repo to ESM (`"type": "module"` — touches ~20 `tsx` scripts and the Docker entrypoint), a mandatory generator `output` path (moves the client out of `node_modules`, breaking the Dockerfile's `COPY node_modules` + `npm prune` step), rewriting 4 test files that use the removed `datasources` constructor option, and updating 3 route handlers using the relocated `Prisma.PrismaClientKnownRequestError`. Schema-adjacent (recall-change-control Class 1) against 22 live migrations — do deliberately, not as a routine bump.
- **TypeScript 7 / ESLint 10** — closed as unmergeable PRs #14/#17 (2026-08-13), both blocked upstream, not by our code. TS 7: `typescript-eslint` refuses to load (`typescript-eslint does not support TS 7.0` — peer range caps at `<6.1.0`, tracked at typescript-eslint#10940; TS 7 shipped without a stable programmatic API, expected in 7.1). ESLint 10: `eslint-plugin-react` (transitive via `eslint-config-next`) crashes loading `react/display-name` (`contextOrFilename.getFilename is not a function`) — revisit once `eslint-config-next` ships ESLint-10-ready plugin deps. Interim option if TS urgency arises: TS 6.0 is inside the supported peer range.
