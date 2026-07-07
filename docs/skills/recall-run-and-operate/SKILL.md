---
name: recall-run-and-operate
description: Run, deploy, and operate the Recall SRS app — local dev server (npm run dev on :3000), production build/start, Docker image and compose stack, the migrate→seed→serve boot sequence, Coolify/VPS deployment, Caddy reverse proxy and HTTPS, nightly SQLite backups, reading feedback, CSV export, progress reset, secret rotation, and post-deploy checks. Use for "how do I run this", "deploy to the VPS", "where does the database live", "backup the db", or operating a live instance.
---

# Recall — Run and Operate

Runbook for running the app locally (Windows dev machine), building for production, and operating the Dockerized instance on a Linux VPS. All commands verified against `package.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `next.config.ts`, and `docs/DEPLOYMENT.md` as of 2026-07-07 (Next.js 16.2.10, Prisma 6, Node 22-alpine images).

## When NOT to use

- Installing deps, env-var setup, first-time repo bootstrap → `recall-build-and-env`
- App crashes, failing builds, weird runtime behavior → `recall-debugging-playbook`
- Changing schema/scheduler/API code safely → `recall-change-control`
- Tests and QA gates → `recall-validation-and-qa`

## Local development

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server on http://localhost:3000 |
| `npm run build` | Production build (standalone output, see below) |
| `npm start` | Serve the production build on :3000 |
| `npm run db:migrate` | `prisma migrate dev` (creates/applies migrations locally) |
| `npm run db:seed` | `prisma db seed` → runs `tsx prisma/seed.ts` |
| `npm test` / `npm run test:e2e` | Vitest / Playwright |
| `npx prisma studio` | Browser GUI to inspect/edit the local database |

- Local SQLite database: **`prisma/dev.db`** — `.env` sets `DATABASE_URL="file:./dev.db"`, which Prisma resolves relative to `prisma/schema.prisma`. It is not the Docker database.
- `.claude/launch.json` defines one preview config: name `dev`, `npm run dev`, port 3000.

## Production build (no Docker)

`next.config.ts` sets `output: "standalone"`: `npm run build` emits a self-contained server at `.next/standalone/server.js` (static assets in `.next/static`, must be copied alongside — the Dockerfile does this). `npm start` (`next start`) also works for a quick local prod check. The config also injects baseline security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy) on every route; HSTS and TLS are deliberately left to the reverse proxy.

## Docker

Image (multi-stage, `node:22-alpine`): `deps` (npm ci) → `build` (`npx prisma generate` + `npm run build`) → `runner` (standalone bundle + prisma CLI/tsx bits needed at boot). Runner defaults: `NODE_ENV=production`, `PORT=3000`, `DATABASE_URL=file:/data/recall.db`.

Boot sequence (`docker-entrypoint.sh`, runs on every container start):

1. `mkdir -p /data`
2. `prisma migrate deploy` — applies pending migrations to the live db
3. One-time seed: if `/data/.seeded` does **not** exist, run `tsx prisma/seed.ts` and `touch /data/.seeded`; otherwise skip
4. `exec node server.js`

Compose (`docker-compose.yml`): single service `app`, port `3000:3000`, named volume **`recall-data` mounted at `/data`**, `restart: unless-stopped`. Required env: `NEXTAUTH_SECRET` (compose fails fast if unset), `NEXTAUTH_URL` (defaults to http://localhost:3000).

```bash
docker compose up -d --build      # first run or update
docker compose logs -f app        # watch migrate/seed/boot output
```

## Deploying to the VPS (from docs/DEPLOYMENT.md)

Two paths:

**Coolify (preferred):**

1. Point an A/AAAA record at the server and verify with `nslookup` first.
2. New → Private Repository → this repo, `main` branch, build pack **Docker Compose** (shipped compose file used as-is).
3. Set env vars: `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://<subdomain>`, `DATABASE_URL=file:/data/recall.db`.
4. **DATA-LOSS-CRITICAL: confirm the `/data` volume is persistent in the Storage tab** — without it every redeploy wipes all accounts and progress.
5. Set the domain (Coolify provisions TLS); optionally add HSTS in proxy settings.
6. Deploy and smoke-test: sign up, enroll a list, review cards.
7. Updates are just `git push`.

**Manual compose + Caddy:** `cp .env.example .env`, fill secrets, `docker compose up -d --build`, then Caddy in front:

```caddy
recall.example.com {
    encode zstd gzip
    reverse_proxy localhost:3000
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}
```

Caddy auto-provisions Let's Encrypt certs. Never expose :3000 directly to the internet.

Update procedure: **take a backup first**, then `git pull && docker compose up -d --build` — migrations run automatically on boot. Single-instance only: SQLite + in-memory rate limiter mean multiple replicas would split state.

**Secret rotation warning (from DEPLOYMENT.md):** if a `NEXTAUTH_SECRET` from local dev ever landed in a commit or shared machine, generate a fresh one for production (`openssl rand -base64 32`). Never commit the real `.env`.

## Backups

The documented approach: nightly cron using SQLite's **online backup** command (consistent snapshot while the app runs), then copy off-box:

```bash
# /etc/cron.d/recall-backup — 3am nightly (adjust volume path)
0 3 * * * root sqlite3 /var/lib/docker/volumes/recall_recall-data/_data/recall.db \
  ".backup '/var/backups/recall-$(date +\%F).db'"
```

Then rsync/rclone the snapshot to another host or object storage; prune on your own retention. For near-zero-RPO, DEPLOYMENT.md suggests Litestream (WAL streaming to S3-style storage). Keep the db file `chmod 0600`. (Actual volume path on the live Coolify host is under `/var/lib/docker/volumes/` — exact name unverifiable from the repo; check with `docker volume ls` on the VPS.)

## Operations checklist

**After every deploy:**
- [ ] `docker compose logs app` (or Coolify logs): migrations applied cleanly, "Seed already applied — skipping." on non-first boots
- [ ] App responds on :3000 behind the proxy; sign in, load dashboard, review one card
- [ ] Volume still mounted at `/data` (data survived the deploy)

**Routine tasks:**
- Read user feedback: `npx prisma studio` against the target `DATABASE_URL`, open the **Feedback** table (feedback is submitted via `POST /api/feedback`).
- CSV export: users self-serve via the account page (`GET /api/account/export`).
- Progress reset: user-initiated via `POST /api/account/reset` (account page).

## Data conventions

- **Seeded vs user content:** the seed provides starter lists/words; user-created content is owned by user rows. The seed runs exactly once per volume.
- **Never re-seed a live volume.** `/data/.seeded` exists precisely so restarts and redeploys never re-run the seed and clobber user data. Do not delete the marker on a live instance; deleting it causes the next boot to seed again on top of real data.
- Local (`prisma/dev.db`) and production (`/data/recall.db` on volume `recall-data`) databases are entirely separate; never point local tooling at production data casually.

## Provenance and maintenance

Re-verify volatile facts:
- Scripts/ports: `cat package.json` (scripts block)
- Boot sequence: `cat docker-entrypoint.sh`
- Image layout / env defaults: `cat Dockerfile docker-compose.yml`
- Standalone output + headers: `cat next.config.ts`
- Deploy/backup procedure: `cat docs/DEPLOYMENT.md`
- Live VPS state (volume names, cron, Coolify config) is **not verifiable from this repo** — check on the host.
