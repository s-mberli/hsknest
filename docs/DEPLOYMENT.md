# Deployment

A guide to self-hosting HSK Nest on a small VPS with Docker Compose, HTTPS via a
reverse proxy, and nightly backups. The default stack is a single container
with a SQLite database on a mounted volume — plenty for a personal or
small-group instance.

## Prerequisites

- A Linux VPS with Docker and the Compose plugin installed.
- A domain name pointed at the server (for automatic HTTPS).
- Ports 80 and 443 open (the app itself listens on 3000, behind the proxy).

## Environment

Never commit your real `.env`. Copy the template and fill it in:

```bash
cp .env.example .env
```

Set at minimum:

| Variable          | Notes                                                          |
| ----------------- | -------------------------------------------------------------- |
| `NEXTAUTH_SECRET` | Generate a strong value: `openssl rand -base64 32`.            |
| `NEXTAUTH_URL`    | The public URL, e.g. `https://hsknest.example.com`.             |
| `DATABASE_URL`    | Leave as `file:/data/recall.db` for the Docker/SQLite default. |

> **Rotate any secret that was ever in a working copy before publishing the
> repo.** If a `NEXTAUTH_SECRET` from local development ever landed in a commit
> or a shared machine, generate a fresh one for production.

## Run with Docker Compose

```bash
docker compose up -d --build
```

On **every** boot the container entrypoint:

1. runs `prisma migrate deploy` to bring the schema up to date,
2. seeds/refreshes starter content if `AUTO_SEED` is `true` (the default) —
   this is idempotent and safe on every restart: it only adds lists that don't
   exist yet or restores an untouched starter list, it never touches your
   accounts, progress, or review history,
3. runs the guest-pruning and duplicate-progress maintenance scripts, then
4. starts the standalone Next server (`node server.js`).

This means new starter content (e.g. a newly-added language) shows up
automatically the next time you redeploy — no manual re-seed step needed.

The database lives in the named volume `recall-data`, mounted at `/data`.

### Reading Mode content

Reading Mode's graded stories (text + pinyin + tap dictionary — small text
files, no audio or fonts involved) are baked into the image and ingested on
every boot, the same way starter vocabulary is seeded — idempotent, no
manual step. `/reading` has a populated library out of the box.

Don't want it on a stripped-down instance? Set `READING_MODE_ENABLED=false`
to skip the ingest step; see [CONFIGURATION.md](CONFIGURATION.md). Every
other feature is unaffected either way.

Karaoke audio for stories is a separate, optional layer on top — it's
generated offline and mounted like word/sentence audio, not shipped in the
image. See [docs/AUDIO.md](AUDIO.md#reading-mode-story-audio-separate-pipeline)
if you want it; stories read fine without it.

**`/reading` shows "No stories yet." after a deploy?** The ingest step is
non-fatal on purpose — a content problem shouldn't block boot — but it logs a
loud warning when it fails:

```bash
docker compose logs app | grep -A20 "Ingesting Reading Mode"
```

Re-run it by hand once the underlying issue is fixed:

```bash
docker compose exec app node_modules/.bin/tsx scripts/ingest-story.ts --all --force
```

## Reverse proxy (Caddy) — automatic HTTPS + HSTS

The app ships baseline security headers (X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy) but **does not** set HSTS or terminate TLS —
that belongs at the proxy. Caddy handles both with almost no config:

```caddy
hsknest.example.com {
    encode zstd gzip
    reverse_proxy localhost:3000
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}
```

Caddy provisions and renews Let's Encrypt certificates automatically. Any
proxy works (nginx, Traefik) — the essentials are TLS termination and the HSTS
header.

## Deploying with Coolify

If your VPS runs [Coolify](https://coolify.io/), you don't need the manual
compose/Caddy steps above — Coolify builds from your git repo, injects env
vars, and terminates HTTPS through its bundled proxy:

1. **DNS first**: create an `A` record for your chosen subdomain pointing at
   the server's public IP (plus an `AAAA` record if you have IPv6). Verify with
   `nslookup <your-subdomain>` before deploying, or certificate issuance will
   fail.
2. In Coolify: **+ New → Private Repository**, connect your GitHub account (or
   a deploy key), pick this repo and the `main` branch, and set the build pack
   to **Docker Compose** — the shipped `docker-compose.yml` is used as is,
   including the migrate-and-seed-on-boot entrypoint.
3. Set the environment variables from the table above (`NEXTAUTH_SECRET`,
   `NEXTAUTH_URL=https://<your-subdomain>`, `DATABASE_URL=file:/data/recall.db`).
   Also set `NEXT_PUBLIC_APP_URL` to that same public HTTPS URL explicitly —
   some platforms (Coolify included) can inject their own internal container
   hostname as a default, which silently breaks links inside password-reset
   and verification emails if you don't set this yourself. See
   [CONFIGURATION.md](CONFIGURATION.md) for the full variable list, including
   the optional `RESEND_API_KEY`/`EMAIL_FROM` pair for real email delivery.
4. **Confirm the `/data` volume is persistent** in the service's Storage tab.
   This is the one setting that matters most: without it, every redeploy wipes
   all accounts and progress.
5. Set the domain on the service; Coolify provisions the TLS certificate
   automatically. Add the HSTS header in the proxy settings if desired.
6. Deploy, then smoke-test: sign up, enroll a list, review a few cards.
7. Set up the backup cron below (the volume path is under
   `/var/lib/docker/volumes/` on the Coolify host).

> **After a deployment, verify the backup job still targets the current app
> container or the mounted SQLite volume.** Deployment-specific container names
> change over time; a hardcoded name can silently create empty backup files.

Subsequent updates are just `git push` — Coolify redeploys, and migrations run
on boot.

## Backups

SQLite is a single file; back it up with its online-backup command so you get a
consistent snapshot even while the app is running.

Nightly cron example (adjust the volume path for your Docker setup):

```bash
# /etc/cron.d/recall-backup — 3am nightly
0 3 * * * root sqlite3 /var/lib/docker/volumes/recall_recall-data/_data/recall.db \
  ".backup '/var/backups/recall-$(date +\%F).db'"
```

**Off-box copy (critical)**: a backup on the same machine doesn't survive a lost
server. Copy the backup off-box immediately and retain for at least 7 days:

```bash
# /etc/cron.d/recall-backup-offbox — 4am nightly (1 hour after backup)
0 4 * * * root rclone sync /var/backups/recall-*.db remote:backups/hsknest-prod/ \
  --remove-source-files --older-than 7d --filter '- recall-*.db'
```

(Replace `remote:backups/...` with your rclone target — S3, B2, rsync, etc.
[Configure rclone](https://rclone.org/docs/) for your storage backend; test
first.)

For every new backup, verify that the file is non-zero and passes SQLite's
integrity check before treating it as recoverable:

```bash
test -s /var/backups/recall-$(date +%F).db
sqlite3 /var/backups/recall-$(date +%F).db 'PRAGMA integrity_check;'
```

### Restore procedure

When the live database is corrupted or lost, restore from the backup:

1. **Stop the app container:**
   ```bash
   docker compose down
   ```

2. **Restore the backup over the live database:**
   ```bash
   cp /var/backups/recall-2025-08-07.db /var/lib/docker/volumes/recall_recall-data/_data/recall.db
   ```

3. **Fix permissions** (ensure the app user can read it):
   ```bash
   chmod 0600 /var/lib/docker/volumes/recall_recall-data/_data/recall.db
   chown $(id -u docker):$(id -g docker) /var/lib/docker/volumes/recall_recall-data/_data/recall.db
   ```
   (Adjust user/group to match your deployment; if unsure, use root temporarily or match the compose file.)

4. **Restart the app:**
   ```bash
   docker compose up -d
   ```

5. **Verify:** Log in, check a user account, and review a few cards to confirm
   the data looks right.

**Test the restore procedure at least once** per quarter on a copy of the live
DB to ensure backups are actually usable. A backup that hasn't been tested is
not a backup.

For continuous, near-zero-RPO backups, consider
[Litestream](https://litestream.io/), which streams SQLite's WAL to S3-style
storage. This removes the restore downtime and is recommended for high-availability
setups.

### Hosted-instance extras (self-hosters: skip)

If you run the managed/paid variant (`SELF_HOSTED=false` + `STRIPE_*` env
vars), also schedule the daily trial-lifecycle email job:

```
# /etc/cron.d/recall-trial-emails — 9am daily
0 9 * * * root docker compose -f /path/to/docker-compose.yml exec -T app npx tsx scripts/send-trial-emails.ts

# /etc/cron.d/recall-decline-check — 9:15am daily (weekly nudge, checked daily)
15 9 * * * root docker compose -f /path/to/docker-compose.yml exec -T app npx tsx scripts/check-declining-engagement.ts
```

Both jobs are idempotent (EmailLog table) and exit immediately when
`SELF_HOSTED` isn't `false`, so they're harmless everywhere else.

Stale-guest pruning (`scripts/prune-guests.ts`) is not a cron job — it
already runs at every container boot from `docker-entrypoint.sh`, which is
frequent enough given guests are throwaway by design. No separate schedule
needed.

## File permissions

- Keep the database file readable only by the app user: `chmod 0600 recall.db`.
- Run the container as a non-root user in production where practical, and don't
  expose port 3000 to the public internet directly — only through the proxy.

## Updating

```bash
git pull
docker compose up -d --build   # entrypoint runs `prisma migrate deploy` automatically
```

Migrations are applied on container start, so a rebuild-and-up is all that's
needed. Take a backup first.

## Scaling

This setup is a **single instance**. The in-memory rate limiter and SQLite file
are per-process, so running multiple app replicas would split their state.
Moving to PostgreSQL (and a shared rate-limit store) for horizontal scaling is
on the roadmap; for a personal or small-group instance a single container is
more than enough.
