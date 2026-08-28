# 🪹 HSK Nest

[![CI](https://github.com/s-mberli/hsknest/actions/workflows/ci.yml/badge.svg)](https://github.com/s-mberli/hsknest/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker%20pull-ghcr.io-blue?logo=docker)](https://github.com/s-mberli/hsknest/packages)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

> A self-hostable, FSRS-powered flashcard trainer built for serious language learners. Mandarin-first out of the box, language-agnostic under the hood.

HSK Nest schedules your reviews with FSRS, the same memory model behind modern Anki, right when you're about to forget a word.

It ships Mandarin-first: the complete New HSK 3.0 vocabulary across levels 1–9, 3,000 example sentences with pinyin, dictionary-assisted entry, and natural Azure neural TTS served from your own server.

Own your data, run it on your VPS. No subscriptions, no telemetry, no lock-in.

> 🚀 **Want to use HSK Nest without setting up a server?** Try our managed cloud version. 14-day free trial, then just €10/month.<br>
> 👉 **[Visit hsknest.com to sign up](https://hsknest.com)**
>
> *Prefer to self-host? Keep reading! 100% open-source under AGPL-3.0.*

## Highlights
	
| Feature | Description |
|---|---|
| 🧠 | **FSRS / SM-2 / Leitner** — Pluggable scheduling strategies. |
| 🇨🇳 | **Mandarin-first** — Full New HSK 3.0 (1–9) + 3,000 example sentences with pinyin. |
| 📖 | **Reading Mode** — Graded HSK 1–5 stories with karaoke audio, tap dictionary, and comprehensible-input matching that recommends what to read next. |
| 🥷 | **Word Ninja** — A fast-paced slice-the-falling-word mini-game that drills recognition speed as a break from flashcard review. |
| 👆 | **Gesture-first swipe deck** — Full-screen dark focus mode with keyboard fallback. |
| 🔊 | **Hybrid TTS** — Pre-generated Azure neural clips served locally + Web Speech fallback. |
| 📥 | **CSV / paste import** — Bring vocabulary from spreadsheets or other flashcard tools. |
| 🐳 | **One-command Docker** — Simple self-hosting with automated migrations and seeding. |
| 🌗 | **Light / Dark / System themes** — Plus a dedicated dark focus mode for studying. |
| 🔐 | **Accounts & Data Control** — Email auth, full data export/deletion. Guest trials on the hosted version. |

## Screenshots

| Dashboard | Study deck |
| :---: | :---: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Study deck](docs/screenshots/study.png) |

| Word-strength browser | List editor |
| :---: | :---: |
| ![Word browser](docs/screenshots/words.png) | ![Lists](docs/screenshots/lists.png) |

## Quick start

**TL;DR (Docker):**

```bash
docker run -d -p 3000:3000 -v hsknest-data:/data ghcr.io/s-mberli/hsknest:latest
```

**Full local development:**
Requires Node.js 20+ (the Docker image runs on Node 26).

```bash
# 1. Clone and install
git clone https://github.com/s-mberli/hsknest.git && cd hsknest
npm install

# 2. Configure environment
cp .env.example .env      # then edit: set NEXTAUTH_SECRET (`openssl rand -base64 32`)

# 3. Generate Prisma Client
npx prisma generate

# 4. Create the database and apply migrations
npm run db:migrate

# 5. Seed starter content (sample languages + word lists)
npm run db:seed

# 6. Ingest Reading Mode's graded stories (optional — flashcards work without
#    this; skip it and /reading just shows an empty library until you run it)
npx tsx scripts/ingest-story.ts --all --force

# 7. Run the dev server
npm run dev
```

Open http://localhost:3000, create an account, add or import a word list, and start studying.

### Audio

Recall ships without audio files baked into the image (too large for git).
The container downloads them itself on first boot — no Python toolchain,
no `docker cp`.

**Default:** story narration for Reading Mode (~10MB) installs automatically.

**To add word + sentence audio**, set in Coolify → Environment Variables (or
your `.env`): `AUDIO_PACKS=stories words sentences` — then redeploy.

**To skip audio entirely:** `AUDIO_PACKS=`

**No internet on your server?** Download packs from
[Releases](https://github.com/s-mberli/hsknest/releases), then
`docker cp` + `tar -xzf` onto the audio volume — see `docs/AUDIO.md`.

**No audio playing?** Run `docker exec <container> npm run doctor` — it
reports what's installed, what's missing, and why, from inside the
container (no login, no admin route needed).

## Self-hosting

For self-hosting on a VPS with Docker Compose, HTTPS via a reverse proxy, and nightly backups, see `docs/DEPLOYMENT.md`. 

```bash
cp .env.example .env      # set NEXTAUTH_SECRET and NEXTAUTH_URL
docker compose up -d --build
```

The container will:
- Auto-generate a `NEXTAUTH_SECRET` and persist it to `/data/.nextauth-secret` (survives restarts)
- Auto-seed starter content (HSK vocabulary + lists) on first boot
- Auto-ingest Reading Mode's graded stories on every boot (idempotent; set `READING_MODE_ENABLED=false` to skip)
- Apply any pending database migrations
- Serve the app at `http://localhost:3000`

Visit `http://localhost:3000`, create an account, and start studying. Your data lives entirely in the `hsknest-data` volume.

## Tech stack

- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui-style primitives + framer-motion
- **Database**: Prisma ORM with SQLite, including in production (single-file, backed up nightly; Postgres is schema-swappable in principle but untested. SQLite is what actually runs hsknest.com)
- **Auth**: NextAuth.js (Credentials provider, JWT sessions)
- **Validation**: Zod
- **Testing**: Vitest (unit) + Playwright (E2E)

Deeper guides live in `docs/`: [IMPORT.md](docs/IMPORT.md) (bring your own vocabulary), [CONFIGURATION.md](docs/CONFIGURATION.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), [AUDIO.md](docs/AUDIO.md).

## Changelog & roadmap

See **[RELEASES.md](RELEASES.md)** for release notes, recent fixes, and what's next.

## Contributing

Bug reports and ideas: file them from the app (**Settings → Feedback**), open an issue, or see `CONTRIBUTING.md` for the PR guide.

## Security

Found a vulnerability? See **[SECURITY.md](SECURITY.md)** for how to report
it privately — please don't open a public issue.

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
