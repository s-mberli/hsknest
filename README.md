# 🪹 HSK Nest

[![CI](https://github.com/s-mberli/hsknest/actions/workflows/ci.yml/badge.svg)](https://github.com/s-mberli/hsknest/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker%20pull-ghcr.io-blue?logo=docker)](https://github.com/s-mberli/hsknest/packages)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

> A self-hostable, FSRS-powered flashcard trainer built for serious language learners. Mandarin-first out of the box, language-agnostic under the hood.

HSK Nest is an open-source, self-hostable flashcard app that uses the state-of-the-art FSRS memory model to schedule reviews exactly when you're about to forget. 

It ships Mandarin-first — the complete New HSK 3.0 vocabulary (levels 1–9), 3,000 real-world example sentences with pinyin, dictionary-assisted entry, and natural Azure neural TTS served entirely from your own server. The scheduling engine is language-agnostic, so you can import CSV decks for anything else (German and Spanish starters are bundled).

Own your data. Run it on your VPS. No subscriptions, no telemetry, no lock-in.

> 🚀 **Want to use HSK Nest without setting up a server?** Try our managed cloud version. 14-day free trial, then just €10/month.<br>
> 👉 **[Visit hsknest.com to sign up](https://hsknest.com)**
>
> *Prefer to self-host? Keep reading! 100% open-source under AGPL-3.0.*

## Contents

- [Why HSK Nest?](#why-hsk-nest)
- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [How it compares](#how-it-compares)
- [Quick start](#quick-start)
- [Self-hosting](#self-hosting)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

## Why HSK Nest?

- 🧠 **State-of-the-art scheduling** — FSRS by default (with SM-2 & Leitner options), switchable per-account without losing progress.
- 🇨🇳 **Mandarin-first content** — Full New HSK 3.0 (levels 1–9), 3,000 Tatoeba sentences with pinyin, and CC-CEDICT dictionary assist.
- 🏠 **Truly self-hostable** — Your data, your VPS, your audio. No subscription lock-in. AGPL-3.0 licensed.
- 🔊 **Natural on-device pronunciation** — Pre-generated Azure neural TTS served locally, with Web Speech API fallback for custom words.

## Highlights
	
| Feature | Description |
|---|---|
| 🧠 | **FSRS / SM-2 / Leitner** — Pluggable scheduling strategies, switchable per-account. |
| 🇨🇳 | **Mandarin-first** — Full New HSK 3.0 (1–9) + 3,000 example sentences with pinyin. |
| 👆 | **Gesture-first swipe deck** — Full-screen dark focus mode with keyboard fallback. |
| 🔊 | **Hybrid TTS** — Pre-generated Azure neural clips served locally + Web Speech fallback. |
| 📥 | **CSV / paste import** — Bring vocabulary from spreadsheets or other flashcard tools. |
| 🐳 | **One-command Docker** — Simple self-hosting with automated migrations and seeding. |
| 🌗 | **Light / Dark / System themes** — Plus a dedicated dark focus mode for studying. |
| 🔐 | **Accounts & Guest Mode** — Email auth, throwaway guest trials, full data export/deletion. |

## Screenshots

| Dashboard | Study deck |
| :---: | :---: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Study deck](docs/screenshots/study.png) |

| Word-strength browser | List editor |
| :---: | :---: |
| ![Word browser](docs/screenshots/words.png) | ![Lists](docs/screenshots/lists.png) |

## How it compares

| Feature | HSK Nest | Anki | Mochi | RemNote |
|---|---|---|---|---|
| FSRS by default | ✅ | ⚠️ (addon) | ❌ | ❌ |
| Fully self-hostable | ✅ | ⚠️ (sync only) | ❌ | ❌ |
| Mandarin-first content | ✅ | ⚠️ (find decks) | ❌ | ❌ |
| On-device natural TTS | ✅ | ❌ | ❌ | ❌ |
| Modern web UX | ✅ | ❌ | ✅ | ✅ |
| Open source | ✅ AGPL | ✅ AGPL | ❌ | ❌ |

## Quick start

**TL;DR (Docker):**

```bash
docker run -d -p 3000:3000 -v hsknest-data:/app/data ghcr.io/s-mberli/hsknest:latest
```

**Full local development:**
Requires Node.js 18+ (Node 22 recommended).

```bash
# 1. Clone and install
git clone https://github.com/s-mberli/hsknest.git && cd hsknest
npm install

# 2. Configure environment
cp .env.example .env      # then edit: set NEXTAUTH_SECRET (`openssl rand -base64 32`)

# 3. Create the database and apply migrations
npm run db:migrate

# 4. Seed starter content (sample languages + word lists)
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open http://localhost:3000, create an account, add or import a word list, and start studying.

## Self-hosting

For self-hosting on a VPS with Docker Compose, HTTPS via a reverse proxy, and nightly backups, see `docs/DEPLOYMENT.md`. 

The short version:

```bash
cp .env.example .env      # set NEXTAUTH_SECRET and NEXTAUTH_URL
docker compose up -d --build
```

The container applies migrations and seeds starter content on first boot, then serves the standalone Next.js build.

## Features

### Content & Import

- **Multi-language by design** — Every word carries a term, translation, optional phonetic, and free-form metadata (tones, gender, part of speech, etc.). Any language fits without schema changes.
- **Your own content** — Create lists, add words one at a time, or paste/CSV import a whole batch. Add a language inline when none fits.
- **Paste / CSV import** — Auto-detects tab vs comma, maps columns to term/meaning/reading, and skips blank or duplicate entries.
- **Real example sentences** — 3,000 curated sentences (Tatoeba, CC-BY) with pinyin and translation appear on flashcards and in the word browser.
- **Graded Chinese content** — Full New HSK 3.0 (2021) lists levels 1–9, frequency lists (Top 100/1000), original everyday-conversation and news-reading sets, plus themed starters.
- **Dictionary-assisted entry (Chinese)** — Typing a Chinese word suggests pinyin and meaning from the bundled CC-CEDICT dictionary.

### Study & Practice

- **Gesture-first study** — A full-screen card stack in a dark focus mode. Tap to reveal, swipe to grade. Keyboard fallback on desktop (← → ↑ ↓).
- **Practice modes** — Meaning quiz, reading quiz (symbol → sound), matching rounds (pair words/meanings), and sentence practice. All pressure-free—they never move the review schedule.
- **Hide-the-reading mode** — Flashcards skip the reading hint so you recall pronunciation yourself; it still appears with the answer.
- **Sound effects** — Subtle, dependency-free Web Audio cues on correct grades and streaks (toggleable).
- **Hybrid pronunciation** — High-quality, pre-generated Azure neural TTS clips served locally. Falls back to browser Web Speech API for custom words. Mandarin (words + sentences) and German (words) supported out of the box.
- **Adjustable card text size** — Small / normal / large study text, per-account.
- **Study scope** — Narrow a session to one language and/or specific lists; the choice is remembered.

### Scheduling & Progress

- **Selectable algorithms** — FSRS (default), SM-2 (adaptive ease factor), or Leitner (5 fixed boxes). Progress is stored as a superset, so switching never loses state.
- **Tunable schedule** — Daily new-word and known-word-check caps, interval/lapse modifiers, mastery cut-off, and optional interval fuzz.
- **Word-strength browser** — See every word banded by recall strength in a searchable table.
- **List priority queue** — Reorder studying lists to control where new words come from. Reviews still come from everywhere.
- **Lifetime stats** — Total reviews, days studied, recall rate, and words-per-day pace.
- **Focus-ring dashboard** — Due counts, words learned, streak, and a 7-day review forecast.
- **One word, one card** — The same word in several lists shares a single progress record. Stats and reviews never double.

### Account & System

- **HSK-level onboarding** — Pick your level at signup and the matching deck is enrolled before your first review.
- **Accounts & auth** — Email + password via NextAuth, bcrypt hashing, rate-limited signup/login, soft email verification, and self-service password reset.
- **Guest mode with upgrade** — One click creates a throwaway account with a starter list. Liked it? One small form turns the guest into a real account and keeps all data.
- **Light / Dark / System theme** — A real account setting that follows you across devices.
- **Organized list shelf** — Lists grouped into Studying / Your lists / Explore. Hide starter lists you don't want.
- **Data control** — Export every word and its progress as CSV, reset progress, or delete the account entirely.
- **In-app feedback** — Report a bug or share an idea straight from Settings.

## Tech stack

- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui-style primitives + framer-motion
- **Database**: Prisma ORM with SQLite for local dev (swap to Postgres for production)
- **Auth**: NextAuth.js (Credentials provider, JWT sessions)
- **Validation**: Zod
- **Testing**: Vitest (unit) + Playwright (E2E)

## Project layout

```text
src/
  app/            # App Router pages + API routes
  components/     # UI primitives + study/dashboard/list components
  hooks/          # useStudySession (session + optimistic reviews)
  lib/
    srs/          # spaced-repetition strategies (FSRS, SM-2, Leitner) + registry
    import.ts     # dependency-free delimited-text parser for imports
    ownership.ts  # per-user list/language visibility rules
    validation.ts # Zod schemas for every API input
    rateLimit.ts  # in-memory fixed-window limiter (auth + feedback)
    speech.ts     # Web Speech API pronunciation wrapper
    auth.ts       # NextAuth configuration
    prisma.ts     # Prisma client singleton
prisma/
  schema.prisma   # data model
  seed.ts         # starter languages + word lists
scripts/
  screenshots.mjs # Playwright helper that captures the README screenshots
docs/
  ARCHITECTURE.md # data model + SRS strategy pattern + request flow
  AUDIO.md        # generating and self-hosting natural TTS audio clips
  CONFIGURATION.md# environment variables, settings, audio, feedback
  DEPLOYMENT.md   # VPS / Docker deploy guide + backups
```

For more details on the SRS algorithm, data model, and configuration options, check the `docs/` directory.

## Roadmap

**In progress (v0.2):**

- 🗓️ **Study reminders / schedule** — calendar of upcoming reviews with optional notifications
- ⌨️ **More practice modes:** type-the-answer (phonetic-aware) and picture quiz
- 🎙️ **Speaking-practice mode** — say the word aloud and get graded by speech recognition
- 🔑 **Bring-your-own-key integrations:** cloud TTS and image generation via server proxy
- 🔥 **Review heatmap / streak calendar;** per-list success and learning curve

<details>
<summary><b>✅ Shipped (v0.1 MVP)</b></summary>

multi-language schema · SM-2 + Leitner (selectable) · staged-reveal study with gesture + keyboard grading · daily new/review caps + session sizing · algorithm tuning (interval/lapse modifiers, mastery, fuzz) · assumed-known + daily checks · weak-word triage · word-strength browser · focus-ring dashboard + 7-day forecast · CSV/paste import · user-created lists & words · Light/Dark/System theme + study-screen focus setting · study-scope filtering · graded HSK + original Chinese lists · CSV export · progress reset · on-device pronunciation · security hardening (rate limits, input caps, headers) · in-app feedback · Docker + compose self-host packaging · multiple-choice quiz + matching-pairs practice modes · card text sizing · Playwright end-to-end suite · guest mode with account upgrade + stale-guest pruning · account deletion · per-list progress chips · CC-CEDICT dictionary-assisted word entry (Chinese) · session summary with toughest words + re-study · FSRS as a third scheduling strategy · email verification + password reset / account recovery flow · full HSK 1–9 (2021) decks · 3,000 Tatoeba example sentences with pinyin · sentence-practice mode · new-word preview flow (see it once before it's graded) · HSK-level onboarding with deck auto-enroll · auto-play pronunciation setting · hosted-plan billing (Stripe, fully bypassed when self-hosting via `SELF_HOSTED=true`) · cookieless analytics hooks (Umami, opt-in via env) · list priority queue (reorder studying lists to control new-word source) · lifetime stats card (reviews, days studied, recall rate, pace) · hybrid pronunciation engine (pre-generated Azure neural TTS for Mandarin and German with client Web Speech fallback) · card deck spacebar shortcuts for previews · sentence practice mode enhancements (pinyin display and audio replay button).
</details>

## Contributing

Bug reports and ideas are welcome — file them right from the app (**Settings → Feedback**) or open an issue. Pull requests should keep the existing style and pass `npm test`, `npm run lint`, and `npm run build` (the same checks CI runs). 

See `CONTRIBUTING.md` for the full guide (project rules, migration safety, scheduler proof requirements).

## Credits

HSK Nest wouldn't be possible without the open-source language learning community:

- **Example sentences:** Tatoeba (CC-BY 2.0 FR)
- **Chinese dictionary:** CC-CEDICT (CC BY-SA 4.0)
- **Vocabulary data:** New HSK 3.0 lists (MIT-licensed, see `prisma/data/hsk/README.md`)

The app shows these credits in-detail at `/credits`.

## License

The HSK Nest application code is licensed under **AGPL-3.0**. Self-host freely; if you offer it as a service with your own modifications, you must share those modifications. See LICENSE for the full text.

Bundled data carries separate licenses:

| Component | License |
|---|---|
| Application code | AGPL-3.0 |
| HSK vocabulary data | MIT |
| CC-CEDICT dictionary (trimmed) | CC BY-SA 4.0 |
| Example sentences (Tatoeba) | CC BY 2.0 FR |

---

⭐ **If HSK Nest helps you, please star the repo — it helps others find it!**
