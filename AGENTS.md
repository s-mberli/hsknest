# HSK Nest contributor guide

- For product changes, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [RELEASES.md](RELEASES.md); for UI work, inspect the approved tokens in `src/app/globals.css` and the relevant existing components; for domain terminology, use [CONTEXT.md](CONTEXT.md). If `HANDOFF.md` is present locally, use only its relevant recent dated entries for continuation and check them against current code.
- Scheduling supports multiple algorithms. Inspect `src/lib/srs/` and its tests before changing intervals or review state; preserve existing behaviour unless the task changes it. Read the current Prisma schema for data changes instead of redesigning it from a generic language model.
- Read `package.json` for commands. Start with affected tests. Before Playwright, inspect the reused server at port 3000 and its data/environment: tests can create accounts, and `reuseExistingServer` does not establish isolation.
- Preserve phone study usability and the approved visual system. Inspect rendered results for layout changes, including relevant phone widths.
- Local checks, migrations, deployed behaviour, and production data changes are distinct. Commits, releases, live administration, and live-data mutations require explicit task authorisation. Keep unrelated changes intact.
- Agent selection belongs to the active runtime's configuration; this shared guide does not prescribe another vendor's model names or tool APIs.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project learning

After substantial work or a meaningful correction, or when relevant book guidance leaves a knowledge gap, use the [local learning playbook](C:/Users/mrks/Documents/Codex/2026-10-04/p/outputs/learning-system/PLAYBOOK.md) when it is available. Skip routine tasks. Check original sources, existing decisions and a realistic scenario before reversible project-guidance improvements; record evidence and rollback. Shared/global changes remain proposals. This grants no additional action permissions and makes no memory or remote-agent changes.
