# Launch readiness review — 2026-10-09

This review covers the hosted website, signed-in learner flows, scheduling,
user isolation, search metadata, and the self-hosted Docker release. It is
an evidence record, not a guarantee that every browser or operational failure
has been exercised. The named ECC tools and local design/product skill files
were not available in this executor; repository instructions, actual source,
independent reviews, rendered pages and automated checks were used instead.

## Confirmed issues fixed

- The homepage hero had `opacity: 0` in server HTML until hydration ran its
  entrance animation. The video poster was already visible, explaining why
  it could appear to load first. The hero now starts visible; a browser test
  disables JavaScript and verifies the hero and CTA remain visible above the
  teaser. No forced scrolling was added.
- Removed the audio stream without re-encoding the video. The new silent file
  has a new URL to avoid stale caches, contains only H.264 video, lasts exactly
  20 seconds, and is 2,989,664 bytes. No video request occurs before activation.
  Captions retain the tour's text descriptions and no longer describe music.
- Live robots and sitemap previously advertised `http://localhost:3000`.
  Origin resolution now validates the configured application/auth origin and
  falls back to the hosted HTTPS origin. Public pages have individual
  canonicals; auth and app layouts request no indexing. Sitemap contains
  public content rather than login/signup pages.
- Reading encounter/deck writes now enforce language visibility, rejecting
  another user's private language before creating any records.
- Added source-based credential throttling before existing account/global
  limits, plus direct callback tests. It requires a trusted reverse proxy
  overwriting forwarding headers. Limits remain per-process, reset on restart,
  and do not establish protection against a distributed attack.
- Mature cards switching into SM-2 or Leitner recover missing default
  algorithm markers from their shared interval. Leitner retains its own
  16-day ceiling. Learning cards reset stale destination counters after algorithm switches, and assumed-known mastered cards recover mature markers;
  non-FSRS reviews discard stale FSRS scheduling parameters. A JSON algorithm
  marker makes later repeat switches distinguish stale fields from current
  progress without a database migration.
- Bottom navigation announces the current page, login loading exposes a
  status, and completion copy distinguishes practice from scheduled reviews.
- Integration fixtures explicitly create their empty SQLite file before the
  schema engine initializes it, fixing local setup failures without touching
  production data.

## Checks

| Area | Evidence |
| --- | --- |
| Unit/integration | 783 passing assertions across 72 files, including real SQLite ownership, session revocation, billing webhook, reading and review/practice boundaries; no expected-failure scheduling tests remain. |
| Homepage browser | Five isolated Chromium tests passed: pre-hydration visibility, on-demand loading, keyboard/retry behavior, native playback/captions/range delivery, widths 320/390/768/1440. |
| Source checks | TypeScript and full ESLint passed. Production build passed, including dictionary tracing. Coverage passed: statements 84.88%, branches 76.84%, functions 85.3%, lines 86.18%. |
| Dependencies | Security policy passed; only the documented development-only braces exception is allowed, expiring 2026-10-17 UTC. |
| Content structure | Seven HSK vocabulary files contain 11,000 entries with no blank term/translation/pinyin; 3,000 sentences have no duplicate text or missing required fields. This does not verify linguistic accuracy. |
| Reading provisioning | All 17 stories ingested into the isolated local database. |
| Docker baseline | Existing edge image publication succeeded for deployed commit 8575778; stable latest had a different digest. v0.3.1 is the planned stable release for this verified change. |

The independent visual review captured 56 combinations (14 routes × phone/desktop
× light/dark). It found no horizontal overflow, missing image alt text, unnamed
inputs or duplicate IDs. Future heatmap cells now have dated accessible labels.
Initial browser execution exposed a NextAuth HTTP-200 CSRF retry response being
treated as successful login without a session; the shared sign-in helper now
retries that explicit response once, checks for an actual session, and restores
form state on failure. Seven helper tests cover success, bounded CSRF retry, invalid
credentials, missing session and transport failure. A browser regression tests
the retry against a real subsequent sign-in. The final fresh journey-suite
verified all 60 cases: 59 passed in the full run; the remaining case passed after correcting an outdated practice-completion text assertion.

## Operational limits and follow-up

- Tests create throwaway accounts only in the isolated local database. No
  production account, review history, subscription, or billing event was
  mutated by the audit. Guest checkout tests mock Stripe; they are not proof
  of a real charge, webhook delivery, cancellation or billing-portal behavior.
- Real email delivery, trusted proxy configuration, backup freshness/off-box
  retention and a production restore drill need operator evidence. Repository
  configuration and a healthy HTTP endpoint cannot certify them.
- Chromium is exercised here; real iPhone Safari/Android and assistive
  technology checks remain separate. Rendered heuristic checks are not a full
  accessibility audit or formal performance/penetration test.
- Production is a single SQLite instance. Rate limit state is process-local;
  multiple replicas require an architectural change, not more containers.
- Revisit/remove the development dependency exception before its expiry.
- Reading's visible Testing label remains intentional beta labeling, rather
  than being removed to imply maturity the review cannot establish.

## Release verification

The local v0.3.1 candidate passed the checks above. Required GitHub CI, live
deployment verification and stable image publication are release gates. Exact
merged commit, workflow and image references are recorded in the GitHub release
and local handoff after those gates complete.
