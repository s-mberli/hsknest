# ADR 0001 — Audio availability is derived, never stored

**Status:** Accepted (2026-08-22)

## Context

HSK Nest serves three kinds of pre-generated audio, all of it optional and none
of it in git (see `docs/AUDIO.md`): per-word clips, per-sentence clips, and
Reading Mode story narration with a word-timing sidecar. In Docker deployments
all of it lives on a mounted volume (`recall-audio` → `/app/public/audio`),
installed by the operator after the fact.

Two different designs existed for answering "does this thing have audio?":

- **Word/sentence clips** (`src/lib/audio.ts`) derive the answer from the
  artifact: the URL is a content hash of the text, the client requests it, and
  a 404 falls back to Web Speech. Its docstring states the rationale — no DB
  column, survives DB reseeds, and "nothing breaks without the audio volume".
- **Story narration** stored the answer in a `ReadingAudio` table, written as a
  side effect of running `scripts/ingest-story.ts`. The reader rendered a
  player only if a row existed.

The stored version failed in production. `ingest-story.ts` decided whether to
write the row by stat-ing `audio-out/zh/r` — a generation scratch directory
that exists only on the machine that ran the Python generator, never in the
image and never on a volume. A self-hoster who generated narration and placed
it correctly under `public/audio/zh/r` would get no player, forever, with no
error logged anywhere. Diagnosing it required tracing the schema and SSHing
into the container.

The wrong directory string was the trigger, but not the defect. The defect is
that a DB row asserted a fact about the filesystem with nothing keeping the two
in sync. The same design permitted the mirror failure: delete an mp3 and the
row persists, so the UI renders a play button over a 404.

## Decision

**The artifact on disk is the availability signal. No DB row ever asserts that
a file exists.**

Concretely, for story narration (`src/lib/reading/storyAudio.ts`):

- `resolveStoryAudio(slug)` checks for the mp3 *and* a parseable timings
  sidecar at render time, returning `null` unless both are present. "Can we
  render a player" and "does the file exist" become the same question asked at
  the same instant.
- Exactly one module owns the path constant, and every consumer — the reader
  page, `ingest-story.ts`, any future diagnostic — imports it rather than
  keeping a copy. A second copy is how the directories drifted apart.
- Derived metadata (`voice`, `durationMs`) is read from the sidecar, which
  already carried both. The DB row was duplicating data that was on disk.

`ReadingAudio` is abandoned in place first (nothing reads or writes it) and
dropped in a later migration, because self-hosters run production SQLite with
no undo — the intermediate state is fully revertable by reverting a commit.

## Consequences

- The class of bug where disk and database disagree about audio is eliminated
  by construction, in both directions.
- Installing audio becomes "put the file in the right place" with no second
  reconciliation step to forget. That step existing at all was the usability
  defect underneath the technical one.
- Lookups are memoized with a short TTL rather than a boot-built manifest,
  deliberately: a manifest would reintroduce the staleness this ADR removes
  (an operator dropping in a file would need a container restart to see it).
- The two resolvers stay separate modules, and legitimately so — they differ on
  where the check can run. `src/lib/audio.ts` is client-side and cannot stat a
  disk, so it must use HTTP 404 plus a `missing` set; `storyAudio.ts` is
  server-side and must stat, because it also parses a sidecar the client
  shouldn't wait on. Naming differs for a real reason too: per-term clips are
  content-hashed so a user-created word reuses a seeded clip, whereas a story
  has a stable authored slug where hashing would churn on every typo fix.
  What is unified is this rule, not a shared function.
- New features wanting an `audioUrl` column have something to bounce off.

## Alternatives rejected

- **Keep `ReadingAudio` as a lazily-populated cache.** A cache of a `statSync`
  is negative value — it adds the invalidation problem back for no gain.
- **Build a manifest at boot.** Same staleness class we are removing.
- **Just fix the directory string.** Treats the symptom; leaves the mirror bug
  (row outliving its file) and the next drift entirely possible.
