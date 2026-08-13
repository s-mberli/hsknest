# HSK Nest Releases

Work-in-progress tracking for releases and roadmap. **Unreleased** items are confirmed bugs or planned features under active consideration. **Someday** is a flexible pool of ideas with no commitment — nothing there is slated or scoped.

Solo dev: no GitHub-issues overhead, no artificial milestones. Items move up when done; this file is the single source of truth.

---

## Unreleased (next)

### MVP blockers — Ship immediately

- [ ] **B1. Docker NEXTAUTH_SECRET + AUTO_SEED defaults** — docker-entrypoint.sh generates+persists a secret if unset; defaults AUTO_SEED=true; adds docker run docs to README
- [ ] **B2. Self-host routing** — / redirects to /login when self-hosted (no marketing landing for self-hosters)
- [ ] **B4. POS labels + cookie banner** — Expand CardFace.tsx POS_LABELS to all 36 ICTCLAS codes; delete CookieBanner.tsx entirely
- [ ] **B6. Billing section reorder** — Move {props.billing} to top of Account tab (users shouldn't scroll past language picker to upgrade)
- [ ] **B7. Upgrade-confirmation email** — Add sendUpgradeConfirmationEmail to email.ts; trigger on checkout.session.completed

### Ship when ready (this release)

- [ ] **B5. Font switch live updates** — Add router.refresh() after settings PATCH; define --font-serif with a real CJK serif font (or remove the control entirely)
- [ ] **B3. Sentence linkage fix** — sentenceBuild.ts: drop weak links where term is substring of co-present longer term or is grammatical suffix; regenerate + verify no word loses its only sentence
- [ ] **C1. List-view audio** — Speaker buttons in WordTable / OwnerWordTable / bubble popup via playAudio
- [ ] **C2. llms.txt for AEO** — Add public/llms.txt describing HSK Nest, its pages, and pitch for AI/answer-engine crawlers
- [ ] **B8. Production audio config** — Verify NEXT_PUBLIC_AUDIO_BASE_URL is set in Coolify; confirm 是 clip exists at /audio/zh/w/...mp3

### Nice-to-have (if time)

- [ ] **C3. HSK data export** — One-off script exporting all prisma/data/hsk/*.json to a flat CSV on Desktop for external review

---

## v0.2.1 — 2026-08-13

- ✅ Added "Slice game mode" to roadmap as a future consideration
- ✅ Updated HANDOFF.md with confirmed root causes for all major UX findings
- ✅ Documented TTS 着 (zhe/zhao) mispronunciation fix approach in HANDOFF.md Part 8

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
