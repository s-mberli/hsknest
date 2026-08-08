# Configuration

## Environment variables

Set these in a `.env` file at the project root.

| Variable          | Required | Example                       | Meaning                                                                                     |
| ----------------- | -------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | yes      | `file:./dev.db`               | Prisma connection string. SQLite file for local dev; a Postgres URL in production.          |
| `NEXTAUTH_SECRET` | yes      | output of `openssl rand -base64 32` | Secret used to sign NextAuth JWT session tokens. Use a long random value.             |
| `NEXTAUTH_URL`    | yes\*    | `http://localhost:3000`       | The canonical base URL of the app. Required in most non-local deployments.                  |
| `NEXT_PUBLIC_APP_URL` | no   | `http://localhost:3000`       | Used to build links inside emails (password reset / verification). Usually same as `NEXTAUTH_URL`. |
| `AUTO_SEED`       | no       | `true`                        | Seed/refresh starter word lists on container boot. Idempotent — safe to leave on. Default in `docker-compose.yml` is `true`. |
| `RESEND_API_KEY`  | no       | `re_...`                      | Enables real email delivery (password reset, verification, trial lifecycle) via [Resend](https://resend.com). Without it, links are logged to the server console instead — fine for local dev/self-hosting. (On a hosted instance with `SELF_HOSTED=false`, secret links are never logged; a missing key is reported as a misconfiguration instead.) |
| `EMAIL_FROM`      | no       | `noreply@myapp.com`           | Sender address for outgoing email. Only matters if `RESEND_API_KEY` is set.                 |
| `SELF_HOSTED`     | no       | `true`                        | **Keep the default `true` when self-hosting.** Anything other than an explicit `"false"` disables all billing: no trials, no paywall, no Stripe. Only the managed hosted instance sets `false`. A missing value can never paywall your own server. |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | no | `sk_live_...` / `price_...` / `whsec_...` | Hosted instance only — ignored entirely when `SELF_HOSTED` isn't `"false"`. Checkout, subscription price, and webhook signature verification. |
| `ADMIN_EMAIL`     | no       | `you@example.com`             | Unlocks the read-only operator page at `/mb-admin` for the account with this email. Unset → the page 404s for everyone. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | no | `https://xyz@sentry.io/...` / same / `sntrys_...` / `myorg` / `myproject` | Optional error tracking via [Sentry](https://sentry.io) (free tier available). Leave all blank to disable; self-hosters can point `SENTRY_DSN` at a self-hosted instance or [GlitchTip](https://glitchtip.com) (Sentry-API-compatible, open source). `SENTRY_AUTH_TOKEN` enables source-map upload for readable stack traces (requires `SENTRY_ORG` and `SENTRY_PROJECT`); silent if not set. **Sentry only initializes when `NODE_ENV=production`**, even with a DSN set — `npm run dev` and local test runs (e.g. Playwright) never report, so a DSN left in a local `.env` doesn't pollute the project with dev-machine noise. When a DSN is set, distributed tracing is on at `tracesSampleRate=0.1` (10% of transactions) across client, server, and edge — raise the rate in the config files to capture more while debugging. In Docker/Coolify, `SENTRY_DSN` must be available at **runtime** (server capture) and `NEXT_PUBLIC_SENTRY_DSN` at **build** (inlined into the browser bundle). The Content-Security-Policy allow-lists exactly the DSN's ingest origin, derived automatically from `NEXT_PUBLIC_SENTRY_DSN` — no separate config, but the browser will silently drop every event if `NEXT_PUBLIC_SENTRY_DSN` differs from what the CSP was built with. See [Sentry docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/) for setup. |
| `NEXT_PUBLIC_UMAMI_URL` / `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | no | `https://cloud.umami.is` / `uuid` | Optional cookieless [Umami](https://umami.is) analytics. Both must be set for the script to load; leave empty to ship no analytics at all (the default — funnel events become no-ops). The Content-Security-Policy allow-lists exactly this origin. |

\* Optional in some local setups but recommended everywhere.

To switch to Postgres for production, change the `datasource db` `provider` in `prisma/schema.prisma` from `sqlite` to `postgresql` and point `DATABASE_URL` at your instance, then run `npm run db:migrate`.

## Account settings

All of these are per-user and edited on the **Settings** page (persisted on the `User` record).

### Appearance

- **App theme** — `light` | `dark` | `system`. Applied instantly via `next-themes` (localStorage) and written through to `User.theme` so it follows your account across devices.
- **Study screen** — `dark` (Dark focus) | `follow` (Match app), stored in `User.studyTheme` (default `dark`). Dark focus keeps study sessions dark for low-glare reviewing regardless of the app theme; Match app makes the study screen follow the app theme above. Read server-side by the study page so there is no first-paint flash.

### Learning

- **New words per day** (`dailyNewWords`) — how many brand-new words to introduce daily. `0` pauses new learning and reviews only.
- **Known-word checks per day** (`assumedCheckPerDay`) — how many words you marked as already-known to re-check each day, in case you were wrong.

### Scheduling algorithm

- **Algorithm** (`preferredAlgorithm`) — `SM2` (adaptive), `LEITNER` (fixed boxes), or `FSRS` (modern memory-model scheduler). Progress carries over when you switch.
- **Desired retention** (`desiredRetention`, FSRS only) — target probability of recalling a word when it comes due, 0.70–0.97 (default 0.90). Higher = shorter intervals, more frequent review, higher retention; lower = longer intervals, less review, more forgetting.

### Fine-tuning

- **Interval multiplier** (`intervalModifier`) — scales the gap after a correct answer. Lower = see words more often; higher = space them out.
- **After a slip-up** (`lapseModifier`) — fraction of a word's interval kept after you forget it. `0` resets fully.
- **Retire mastered words** (`masteryThresholdDays`) — once a word's interval passes this length, stop scheduling it. `null`/None reviews forever.
- **Randomize intervals** (`fuzzIntervals`) — adds a small ±5% wiggle so batches of words don't all come due on the same day.

### Data

- **Export CSV** — download every word and its progress.
- **Reset progress** — wipe all progress and review history (two-step confirm; cannot be undone).

## Audio

Pronunciation playback uses your browser's built-in text-to-speech (the Web
Speech API). It is **fully on-device** — no audio is sent to any server and no
API key is required. The speaker button on a study card is muted when your
device has no installed voice for that language; tapping it then explains how to
add one.

Adding a system voice:

- **Windows** — Settings → Time & Language → Language & region → add the
  language, then in Speech settings install its voice pack.
- **macOS** — System Settings → Accessibility → Spoken Content → System Voice →
  Manage Voices, then download a voice for the language.
- **Android** — Settings → Accessibility → Text-to-speech output → your engine →
  Install voice data, then pick the language.

After installing a voice you may need to reload the page for the browser to
pick it up.

## Feedback

In-app feedback (Settings → **Feedback**) and word-quality reports from study
mode (card-flag button) write rows to the `Feedback` table. Viewing requires
`ADMIN_EMAIL` to be set:

1. Set `ADMIN_EMAIL` to your login email in `.env` (or `.env.production` on a deployed instance).
2. Visit `/mb-admin` (logged in as that email).
3. View a stats card showing word-quality report count, and two sections: word-reports (highlighted in amber) and general feedback (bug reports, ideas, etc.).

Feedback rows carry a `status` field (`open` / `closed`); triaging is read-only in the dashboard for now — update status via Prisma Studio if needed:

```bash
npx prisma studio
```

## Content ownership

- **Seeded lists & languages** (created by the seed script) are public and read-only for everyone.
- **User-created lists & languages** are private to their creator: only the owner sees and edits them. Add words manually, import a batch, or edit/delete words and the whole list.
