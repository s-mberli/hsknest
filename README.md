# 🪹 HSK Nest

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![CI](https://github.com/s-mberli/hsknest/actions/workflows/ci.yml/badge.svg)](https://github.com/s-mberli/hsknest/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker%20pull-ghcr.io-blue?logo=docker)](https://github.com/s-mberli/hsknest/packages)

<h3 align="center">
  A modern, self-hostable spaced-repetition trainer built for language learning.
</h3>

<p align="center">
  HSK Nest helps you remember vocabulary the efficient way. Powered by the state-of-the-art <b>FSRS memory model</b>, the app schedules your reviews to bring each word back exactly when you're about to forget it.
</p>

---

## ✨ Why HSK Nest?

- **Language-Agnostic Engine:** While primarily focused on **Mandarin Chinese** (featuring the complete New HSK 3.0 vocabulary and over 3,000 real-world example sentences) and **German** (A1 essentials) right now, the engine is completely language-agnostic. Import CSV decks for *any* language you're memorizing. Plans for more official languages are on the roadmap!
- **Own Your Data:** Run it on your own server, keep everything on-device (even the high-quality TTS audio), and never depend on a subscription cloud service. Export your data at any time.
- **Modern & Beautiful:** Built with a gesture-first swipe deck, rich FSRS analytics, and a beautiful dark mode UI that makes studying a joy, not a chore.

## 📸 Screenshots

| Dashboard | Study Deck |
| :---: | :---: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Study deck](docs/screenshots/study.png) |

| Word-Strength Browser | List Editor |
| :---: | :---: |
| ![Word browser](docs/screenshots/words.png) | ![Lists](docs/screenshots/lists.png) |

## 🚀 Key Features

* **State-of-the-Art Scheduling:** Choose between **FSRS** (the modern default), **SM-2**, or **Leitner** algorithms. Tune your daily caps, mastery cut-offs, and interval modifiers.
* **Practice Modes:** Go beyond flashcards with meaning quizzes, reading quizzes, matching rounds, and sentence practice to recognize words in context.
* **High-Quality Audio:** Ships with hybrid pronunciation, combining pre-generated Natural TTS (Azure neural voices) served entirely from your VPS and seamless fallbacks to the Web Speech API.
* **Rich Content:** Out of the box, get the complete New HSK 3.0 (levels 1-9), frequency lists, and 3,000 Tatoeba example sentences with pinyin. German A1 essentials and Top 100 lists are also included.
* **Custom Decks:** Easily create lists, add words manually, or bulk-import via CSV/TSV with auto-detection for tab vs. comma.
* **Smart UI/UX:** Enjoy a focus-ring dashboard, 7-day review forecasts, lifetime stats, adjustable text sizing, and light/dark themes.
* **Dictionary Assisted (Chinese):** Integrated CC-CEDICT dictionary auto-suggests pinyin and meanings as you type.

## 🛠 Tech Stack

Built for speed, reliability, and developer experience:

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + Framer Motion
- **Database:** Prisma ORM with SQLite (local) / PostgreSQL (production)
- **Auth:** NextAuth.js (Credentials, JWT)
- **Testing:** Vitest (Unit) + Playwright (E2E)

## 🏎 Quick Start (Local Development)

Requires Node.js 18+ (Node 22 recommended).

```bash
# 1. Clone and install
git clone https://github.com/s-mberli/hsknest.git && cd hsknest
npm install

# 2. Configure environment
cp .env.example .env      # Set NEXTAUTH_SECRET (`openssl rand -base64 32`)

# 3. Create the database and apply migrations
npm run db:migrate

# 4. Seed starter content (sample languages + word lists)
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start studying.

## 🐳 Deployment (Self-Hosting)

For self-hosting on a VPS with Docker Compose, HTTPS via a reverse proxy, and nightly backups, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

```bash
cp .env.example .env      # set NEXTAUTH_SECRET and NEXTAUTH_URL
docker compose up -d --build
```

Or pull the prebuilt image directly from GHCR:
```bash
docker pull ghcr.io/s-mberli/hsknest:latest
```

*Note: The container applies migrations and seeds starter content automatically on first boot.*

## 📖 Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Data model, SRS strategy pattern, and request flow.
- **[CONFIGURATION.md](docs/CONFIGURATION.md)**: Environment variables, settings, audio, and feedback.
- **[AUDIO.md](docs/AUDIO.md)**: Generating and self-hosting natural TTS audio clips.
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**: VPS / Docker deploy guide and backups.

## 🤝 Contributing & Roadmap

Bug reports and ideas are welcome! File them straight from the app (**Settings → Feedback**) or open an issue on GitHub. 
Check out our [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide on project rules, migration safety, and testing requirements.

Our upcoming **v0.2 Roadmap** includes:
- Study reminders & calendar integrations
- Type-the-answer & picture quizzes
- Speaking-practice modes utilizing speech recognition
- Bring-your-own-key integrations for cloud TTS & AI image generation
- PostgreSQL horizontal scaling & community list sharing

## 📄 License & Credits

**AGPL-3.0** — Self-host freely! If you offer it as a service with modifications, you must share those modifications. See [LICENSE](LICENSE) for details.

- **Chinese Data:** HSK vocabulary data is MIT-licensed. Bundled dictionary data is a trimmed build of [CC-CEDICT](https://cc-cedict.org/wiki/) (CC BY-SA 4.0).
- **Sentences:** Example sentences provided by [Tatoeba](https://tatoeba.org) (CC-BY 2.0 FR).
