# Deployment

A guide to self-hosting Recall on a small VPS with Docker Compose, HTTPS via a
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
| `NEXTAUTH_URL`    | The public URL, e.g. `https://recall.example.com`.             |
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

## Reverse proxy (Caddy) — automatic HTTPS + HSTS

The app ships baseline security headers (X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy) but **does not** set HSTS or terminate TLS —
that belongs at the proxy. Caddy handles both with almost no config:

```caddy
recall.example.com {
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

Then **copy the backup off-box** (rsync/rclone to object storage or another
host) — a backup on the same machine doesn't survive a lost server. Prune old
snapshots on whatever retention you like.

For continuous, near-zero-RPO backups, consider
[Litestream](https://litestream.io/), which streams SQLite's WAL to S3-style
storage.

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
