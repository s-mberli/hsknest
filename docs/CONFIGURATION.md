# Configuration

## Environment variables

Set these in a `.env` file at the project root.

| Variable          | Required | Example                       | Meaning                                                                                     |
| ----------------- | -------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | yes      | `file:./dev.db`               | Prisma connection string. SQLite file for local dev; a Postgres URL in production.          |
| `NEXTAUTH_SECRET` | yes      | output of `openssl rand -base64 32` | Secret used to sign NextAuth JWT session tokens. Use a long random value.             |
| `NEXTAUTH_URL`    | yes\*    | `http://localhost:3000`       | The canonical base URL of the app. Required in most non-local deployments.                  |

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

- **Algorithm** (`preferredAlgorithm`) — `SM2` (adaptive) or `LEITNER` (fixed boxes). Progress carries over when you switch.

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

In-app feedback (Settings → **Feedback**) writes rows to the `Feedback` table.
There's no admin UI yet — read reports with Prisma Studio:

```bash
npx prisma studio
```

Open the **Feedback** model to see each report's category, message, page, and
status. A feedback admin dashboard is on the roadmap.

## Content ownership

- **Seeded lists & languages** (created by the seed script) are public and read-only for everyone.
- **User-created lists & languages** are private to their creator: only the owner sees and edits them. Add words manually, import a batch, or edit/delete words and the whole list.
