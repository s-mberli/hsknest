# Contributing to HSK Nest

Thanks for your interest! HSK Nest is AGPL-3.0 open source and contributions
of every size are welcome — bug reports, docs fixes, features.

## Quick start

```bash
git clone https://github.com/s-mberli/hsknest.git
cd hsknest
npm install
cp .env.example .env   # fill in NEXTAUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
```

## Before you open a PR

1. **Discuss big changes first** — open an issue or a GitHub Discussion so
   we agree on the direction before you invest serious time.
2. **Tests must pass**:
   ```bash
   npm test           # Vitest unit tests
   npm run build      # production build
   npm run test:e2e   # Playwright (needs the dev DB seeded)
   ```
3. **Scheduler changes need proof.** Anything in `src/lib/srs/*` or the
   queue/cap logic must cite the SM-2/Leitner rule it implements (or the
   deviation it makes on purpose) and come with unit tests in
   `src/lib/srs/__tests__/`. Algorithm functions stay pure.
4. **Migrations must be additive/backward-safe.** Self-hosters run
   `prisma migrate deploy` unattended on boot — never drop or rename
   columns without a written multi-step plan.
5. **New API inputs are validated with Zod** in `src/lib/validation.ts` —
   never inline, never raw `req.json()`.
6. **UI bar**: mobile-first, minimalist, no generic default-looking
   components, and — house rule — no purple gradients.

## Project layout

See the [README](README.md#project-layout) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, ownership
rules, and request flow.

## License

By contributing you agree your work is licensed under
[AGPL-3.0](LICENSE), the same license as the project.
