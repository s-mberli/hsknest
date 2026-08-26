# ADR 0002 — Content reseeding never deletes progress

**Status:** Accepted (2026-08-26)

## Context

`prisma/seed.ts` seeds each official list (HSK, frequency, starter lists) via
`seedList()`. Production runs this on every container boot — `AUTO_SEED`
defaults to `true` in `docker-entrypoint.sh` so self-hosters get starter
content without a manual step.

`seedList()` decided whether a list's content was current by sampling three
positions (first/middle/last) and comparing them to the incoming JSON
(`sameSeedContent()`). On any mismatch, it deleted the list outright
(`deleteSeededList()`, cascading through `Word` to `UserProgress` and
`ReviewLog`) and recreated it from scratch.

A `progressCount()` helper already existed for exactly this situation —
its docstring reads `"0 = safe to replace"` — but nothing ever called it.
The guard was designed and never wired in.

On 2026-08-26, a routine content fix (correcting ~15% of HSK vocabulary
translations/phonetics — see `audits/hsk-gloss-audit-2026-08.md`) changed
enough entries per level that the sampled-position check tripped for all
7 HSK lists. The next production boot (`AUTO_SEED=true`) deleted and
recreated every one of them, destroying roughly 6,700 `UserProgress` rows
and 690 `ReviewLog` rows — including the SRS history (ease factors,
intervals, review counts) of an actively studying paying user, on the same
day they were using the app.

The wrong trigger was a data-only content update — no schema change, no
list rename, nothing that should have been destructive at all.

## Decision

**A content refresh must never be the thing that deletes progress.**

`seedList()` now branches on `progressCount()` before replacing a
mismatched list:

- **Zero progress recorded** — delete and recreate, same as before. Cheap,
  and there is nothing to lose.
- **Real progress recorded** — `refreshListInPlace()` instead: update
  existing `Word` rows by `term` match (preserving `id`, so `UserProgress`/
  `ReviewLog` foreign keys stay valid), append any genuinely new terms, and
  leave terms no longer present in the source data untouched. An automatic
  refresh does not delete rows a human didn't ask it to delete.

## Consequences

- A future content-only fix (more gloss corrections, phonetic fixes, a new
  HSK revision) can ship and deploy without needing to reason about whether
  it will silently wipe study history. The check runs unconditionally, not
  as something an author has to remember.
- Terms removed from an upstream dataset are left behind rather than
  deleted automatically — that is a deliberate asymmetry: silently keeping
  a stale word is recoverable and low-cost; silently deleting a user's
  progress is not. Removing a genuinely retired term is a manual decision,
  not a side effect of a content sync.
- Verified with a live rehearsal against a real seeded DB copy (attach a
  `UserProgress` row, force a content mismatch, run the real `seed.ts`):
  the list took the refresh-in-place path and the exact progress row
  survived with its original id/wordId/state, while a list with zero
  progress still took the cheap delete-and-recreate path unchanged.
- `scripts/fix-hsk-meanings.ts` (the tool for pushing content fixes into an
  already-seeded DB out of band) had a related but separate bug on the same
  day: it read only the base `new{n}.json` files, skipping the
  `curated/*.json` override merge `seed.ts` applies — so a first sync pass
  silently missed all curated translation fixes. Fixed the same day by
  mirroring `seed.ts`'s merge. Not the cause of the progress loss, but
  found while investigating it, and worth noting here since both bugs
  trace back to the same root habit: a script re-reading `prisma/data/hsk`
  directly instead of going through the one place that already encodes
  the correct merge/safety logic.

## Alternatives rejected

- **Set `AUTO_SEED=false` in production and reseed manually.** Fixes this
  one instance but not the underlying defect — the next self-hoster with
  `AUTO_SEED` on (the documented default, meant for exactly this kind of
  automatic refresh) hits the same bug. Also loses the "self-hosters get
  starter content on boot" property the flag exists for.
- **Widen `sameSeedContent()`'s sample or hash the whole list.** Would
  reduce false-negative mismatches but not eliminate them, and does nothing
  about the actual defect: that a real mismatch, however detected, resulted
  in unconditional deletion regardless of what was attached to the list.
- **Never auto-delete a list, full stop.** Rejected because a list with
  zero progress recorded has nothing to lose from a clean recreate, and
  the cheap path is worth keeping for the common case (a fresh install, or
  a list nobody has touched yet).
