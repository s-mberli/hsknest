---
name: recall-fsrs-campaign
description: Executable, decision-gated campaign to add FSRS (Free Spaced Repetition Scheduler) as HSK Nest's third scheduling strategy. Load when implementing FSRS, adding any new scheduling algorithm/strategy to src/lib/srs/, extending the SRSAlgorithmType enum, deciding how to use the UserProgress.srsData JSON field or the ReviewLog history, mapping the 0-5 review quality scale to FSRS grades, wiring difficulty/stability/retrievability state, fitting FSRS parameters from review logs, or answering "how would FSRS fit into this codebase?".
---

# HSK Nest FSRS Campaign

A phased, gated runbook for adding **FSRS** as a third strategy alongside SM-2 and Leitner. Every phase ends in a GATE with an expected observation. Do not proceed past a failed gate — follow its branch note instead.

Facts about this repo below were read from source on **2026-07-07**. Re-verify with the commands in "Provenance and maintenance" if the repo has moved.

## When NOT to use this skill

- SM-2/Leitner/forgetting-curve theory questions → `srs-theory-reference`.
- "Is this change allowed / what tests must pass before merge?" → `recall-change-control` (this campaign routes THROUGH it; it does not replace it).
- What evidence counts as proof, test patterns, E2E journey → `recall-validation-and-qa`.
- Adding a plain user setting unrelated to scheduling → `recall-config-and-settings`.
- Architecture invariants in general → `recall-architecture-contract`.

## Non-negotiables (inherited from project rules)

1. Never break user data: **additive** migrations only; algorithm switching must be **lossless** in both directions.
2. Scheduler changes need spec justification + unit tests.
3. `npm test` and `npm run build` must pass at every gate.
4. Write nothing to `UserProgress` columns beyond what already exists — FSRS state lives in `srsData`.

---

## Ground truth: what exists today (verified 2026-07-07)

### The strategy interface — `src/lib/srs/types.ts`

```ts
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
export type CardState = "NEW" | "LEARNING" | "REVIEW" | "LAPSED" | "MASTERED" | "ASSUMED";
export type SRSAlgorithmType = "SM2" | "LEITNER";

export interface SRSState {
  state: CardState;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  box: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  srsData?: Record<string, unknown>;   // ← FSRS home
}

export interface SRSResult { next: SRSState; }

export interface SRSAlgorithm {
  readonly id: SRSAlgorithmType;
  initialState(now: Date): SRSState;
  calculateNextReview(state: SRSState, quality: ReviewQuality, now: Date): SRSResult;
}
```

Strategies are **pure** (never mutate input). `addDays(date, days)` helper lives in the same file.

### Registry — `src/lib/srs/index.ts`

`const registry: Record<SRSAlgorithmType, SRSAlgorithm> = { SM2: new SM2Algorithm(), LEITNER: new LeitnerSystem() }`, plus `getAlgorithm(type)` (throws on unknown) and `SRS_ALGORITHMS: SRSAlgorithmType[]`.

### Modifier layer — `src/lib/srs/modifiers.ts`

`applyUserModifiers(prev, result, quality, prefs, now, rng?)` runs **after** every strategy, applying `intervalModifier` (success q>=3), `lapseModifier` (q<3), `fuzzIntervals` (±5% when interval >= 2d), `masteryThresholdDays` (→ MASTERED), then recomputes `dueAt = now + intervalDays`. Note: it **overwrites the strategy's dueAt** — FSRS must express its schedule via `intervalDays`, not via a custom dueAt.

### Review route — `src/app/api/study/review/route.ts` (POST /api/study/review)

Flow: auth → Zod `reviewSchema` ({wordId, quality 0-5, reviewedAt?}) → load `User` prefs + `UserProgress` → special-case `ASSUMED` cards (q>=3 → REVIEW at 30d; q<3 → fresh LEARNING at 1d) → otherwise `getAlgorithm(user.preferredAlgorithm).calculateNextReview(...)` → `applyUserModifiers(...)` → transaction: update `UserProgress` (including `srsData: next.srsData ? (next.srsData as Prisma.InputJsonValue) : undefined` — note: `undefined` means "leave unchanged", it does NOT clear) + append `ReviewLog`.

Client callers: `src/lib/postReview.ts` (quiz/match, quality 1 or 4) and `src/hooks/useStudySession.ts` (flashcards: swipe left/down/right/up = 1/3/4/5 — i.e. real users emit **1/3/4/5**; 0 and 2 are schema-legal but unreachable from the UI). Canonical grade/swipe mapping: `srs-theory-reference` §3; modifier semantics: `srs-theory-reference` §6.

### Schema — `prisma/schema.prisma`

- `enum SRSAlgorithmType { SM2 LEITNER }`; `User.preferredAlgorithm SRSAlgorithmType @default(SM2)`.
- `UserProgress`: state, easeFactor, intervalDays (Float), repetitions, box, lapses, dueAt, lastReviewedAt, introducedAt, assumedCheckedAt, `srsData Json?` (comment: "algorithm-specific overflow (future FSRS params, etc.)").
- `ReviewLog` (append-only): userId, wordId, `quality Int` (0-5), `algorithm SRSAlgorithmType`, intervalBefore, intervalAfter, reviewedAt. This is the FSRS replay corpus.

### Settings

- Zod: `src/lib/validation.ts` → `settingsSchema.preferredAlgorithm: z.enum(["SM2","LEITNER"])`.
- API: `src/app/api/settings/route.ts` (GET/PATCH).
- UI: `src/components/settings/SettingsForm.tsx` (local `type Algorithm = "SM2" | "LEITNER"` and an options array).

### Test pattern — `src/lib/srs/__tests__/sm2.test.ts`

Vitest, fixed clock `const NOW = new Date("2026-01-01T00:00:00.000Z")`, `freshState(overrides)` helper, `it.each` tables of exact expected interval/ease/state per quality, a purity test (JSON snapshot before/after). Imitate this exactly for FSRS.

---

## Phase 0 — Preconditions and the grade-mapping design gate

### 0.1 Verify the interface and plumbing still match

```
npm test          # expect: all suites green (sm2, leitner, modifiers, others)
npm run build     # expect: clean Next.js build
```

Confirm `src/lib/srs/types.ts` still matches the interface quoted above. **If the interface changed** (e.g. `SRSResult` gained fields, quality scale changed) → STOP, re-read all of `src/lib/srs/*` and the review route, and update this campaign's assumptions before writing any FSRS code.

### 0.2 Probe: srsData round-trips through the review route

The write path already persists `next.srsData`; the read path already hydrates it (`route.ts` builds `currentState.srsData` from `progress.srsData`). Prove it end-to-end with this exact unit-level probe (or a scripted API probe against a dev DB):

```ts
// scratch probe (or add to a test): does the route preserve srsData?
// 1. In a vitest integration or via `npx prisma studio` / a script:
await prisma.userProgress.update({
  where: { userId_wordId: { userId, wordId } },
  data: { srsData: { probe: 42 } },
});
// 2. POST /api/study/review { wordId, quality: 4 }  (as that user, SM2 active)
// 3. Re-read the row:
const row = await prisma.userProgress.findUnique({ where: { userId_wordId: { userId, wordId } } });
// EXPECTED: row.srsData still equals { probe: 42 } — SM2 spreads `...state` into
// `next`, so srsData is carried through and re-written unchanged.
```

**If you see srsData nulled or dropped instead** → the `undefined`-vs-null handling in `route.ts` (line ~145) or the strategy's spread changed; branch to fixing that plumbing FIRST as its own change-controlled fix. Do not build FSRS on a leaky pipe.

### 0.3 DESIGN GATE: grade-scale mapping (must be decided, in writing)

This repo records **0-5 quality** (SM-2 convention) in both the review API and `ReviewLog`. FSRS canonically uses **4 grades**: 1=Again, 2=Hard, 3=Good, 4=Easy. The UI actually emits only 1 (forgot), 3 (hard), 4 (knew), 5 (easy).

Recommended mapping (adopt unless the owner overrides):

| Repo quality (0-5) | UI source            | FSRS grade |
|--------------------|----------------------|------------|
| 0, 1, 2            | swipe left (1)       | 1 Again    |
| 3                  | swipe down (hard)    | 2 Hard     |
| 4                  | swipe right (knew)   | 3 Good     |
| 5                  | swipe up (easy)      | 4 Easy     |

Decisions this gate must record (a short note in the FSRS file header + the PR description is enough):

1. The table above (or the owner's alternative). It must be **total** over 0-5 and **monotone**.
2. Keep `ReviewLog.quality` on the 0-5 scale unchanged (do NOT re-scale historical logs); the mapping is applied at read time inside the FSRS engine and inside any future replay/fitting code. This keeps the log lossless and algorithm-neutral.
3. The success/lapse boundary stays `quality >= 3` (the modifier layer and route hardcode it) — FSRS Again == quality < 3 keeps everything consistent.

**If the owner wants a different UI (explicit 4-button Again/Hard/Good/Easy)** → that is a separate UI change; branch it through `recall-change-control` independently. FSRS works fine with the swipe mapping.

GATE 0 exit checklist: [ ] tests+build green [ ] srsData probe passed [ ] mapping decision written down.

---

## Phase 1 — Pure FSRS engine: `src/lib/srs/fsrs.ts`

### 1.1 Theory obligation (EXTERNAL CANON — verify before use)

The math below is FSRS-4.5/FSRS-5 as published in the **official fsrs4anki wiki ("The Algorithm")** and the **open-spaced-repetition/py-fsrs** reference implementation. It is stated here from memory of that canon, dated 2026-07-07. **You must diff it against those sources at implementation time; the sources win.**

- State per card: difficulty `D ∈ [1,10]`, stability `S > 0` (days until retrievability drops to 90%).
- Retrievability after `t` days: `R(t,S) = (1 + FACTOR * t / S) ^ DECAY`, with FSRS-4.5 constants `DECAY = -0.5`, `FACTOR = 19/81` (chosen so `R(S,S) = 0.9`). FSRS-5/6 made DECAY a fitted parameter — check which variant the canon currently recommends.
- Next interval for desired retention `r`: `I(r,S) = (S / FACTOR) * (r^(1/DECAY) - 1)`; with defaults and r=0.9, `I = S`.
- 17-19 model weights `w[0..]` (17 in FSRS-4.5, 19 in FSRS-5). Initial stability after first grade G: `S0 = w[G-1]`. Initial difficulty: `D0(G) = w[4] - e^(w[5]*(G-1)) + 1` (FSRS-5 form), clamped to [1,10]. Success stability growth uses `w[8..10]` with retrievability, difficulty and a hard-penalty/easy-bonus (`w[15]`, `w[16]`); lapse stability uses `w[11..14]`; difficulty update uses `w[6]` with mean reversion via `w[7]`.
- Default weight vector: copy the exact array from py-fsrs (`DEFAULT_PARAMETERS`) at implementation time. **Do not type it from memory.** Pin the source version in a comment, e.g. `// FSRS-5 defaults, py-fsrs vX.Y.Z, retrieved 2026-07-##`.

Implementation options, in order of preference:

1. Implement the formulas directly in `fsrs.ts` (no new dependency; matches how SM-2/Leitner are done; easiest to test). Recommended.
2. Depend on `ts-fsrs` (npm). Only if the owner approves a new runtime dependency via `recall-change-control` — and you still must adapt it behind `SRSAlgorithm`.

### 1.2 Contract mapping (this repo, ground truth)

```ts
export class FSRSAlgorithm implements SRSAlgorithm {
  readonly id = "FSRS" as const;              // requires Phase 2 type extension
  initialState(now: Date): SRSState { ... }   // state NEW, easeFactor 2.5 (untouched),
                                              // intervalDays 0, repetitions 0, box 1,
                                              // lapses 0, dueAt now, lastReviewedAt null,
                                              // srsData: undefined (no FSRS state until first review)
  calculateNextReview(state, quality, now): SRSResult { ... }
}
```

Rules:

- **Persist D and S in `srsData`** under a namespaced key, e.g. `srsData: { ...state.srsData, fsrs: { d: number, s: number, v: 1 } }`. Spread the previous `srsData` so other keys survive. Include a small version tag `v` for future format migrations. Do NOT touch `easeFactor` or `box` — leave them exactly as they came in (lossless switching depends on it).
- **Hydration**: if `state.srsData?.fsrs` is missing (card previously scheduled by SM-2/Leitner, or NEW), derive a starting D/S: for a first-ever review use the S0/D0 formulas; for a card with existing `intervalDays > 0` but no FSRS state, seed `S = max(intervalDays, 0.1)` and `D = D0(Good)` — a documented, deterministic bootstrap. Write a comment citing this paragraph.
- `intervalDays = clamp(round-or-float I(desiredRetention, S'), min 1)` — keep it a Float like the rest of the repo (schema uses Float). `dueAt = addDays(now, intervalDays)` — the modifier layer will recompute it anyway.
- `repetitions`: increment on q>=3, reset to 0 on q<3 (mirrors SM-2 semantics; queue/stats code may read it). `lapses`: +1 on q<3.
- **CardState mapping** (this repo's machine): q<3 → `LEARNING` (matches SM-2's lapse behavior here; the repo has LAPSED in the enum but SM-2 uses LEARNING for failures — imitate SM-2 unless the owner asks for LAPSED); q>=3 → `REVIEW`. Never emit `NEW`/`ASSUMED` from the engine. `MASTERED` is the modifier layer's job — do not set it in the engine. `ASSUMED` cards never reach the engine (route short-circuits them).
- Pure: never mutate input; copy the SM-2 purity test.

### 1.3 GATE: unit tests — `src/lib/srs/__tests__/fsrs.test.ts`

Imitate `sm2.test.ts`: fixed `NOW`, `freshState()`, `it.each` tables, purity test, plus: srsData namespacing preserved, hydration-from-SM2 bootstrap deterministic, monotonicity (higher grade ⇒ interval >= lower grade's, same prior state), D clamped to [1,10].

Reference trajectories — **EXPECTED SHAPE ONLY; recompute exact numbers against py-fsrs before hardcoding assertions** (label them in the test file: `// values generated with py-fsrs vX.Y.Z on YYYY-MM-DD`):

1. New card, Good (FSRS grade 3) every review, r=0.9, default FSRS-5 weights: first interval ≈ S0(Good) ≈ **3 days** (w[2], roughly 2-4 with published defaults), then roughly geometric growth (~3 → ~10 → ~30 → ~85 days; growth ratio ~2.5-3.5x).
2. New card, Again then Good then Good: first interval **1 day** (S0(Again) < 1 clamps to min 1), then short (~1-3d), then growing.
3. New card, Easy first: S0(Easy) ≈ **8-16 days** first interval with defaults.

To generate the authoritative numbers: `pip install fsrs` then a 10-line python script replaying the grade sequence with default parameters; paste its output into the test as the expected values, with the version comment.

Exit: `npm test` green including the new file; `npm run build` green. **If intervals are wildly off the reference (e.g. first Good interval of 0.4d or 40d)** → suspect the weight vector or the I(r,S) inversion; re-diff formulas against canon before touching anything else.

---

## Phase 2 — Registry + schema + settings integration

This phase contains a **schema migration → route it through `recall-change-control` before executing.**

Checklist (each row: file → change → expected observation):

| # | File | Change |
|---|------|--------|
| 1 | `prisma/schema.prisma` | `enum SRSAlgorithmType { SM2 LEITNER FSRS }` — additive enum value only. Then `npx prisma migrate dev --name add_fsrs_algorithm`. Inspect the generated SQL: it must not rewrite or drop user rows. (SQLite provider: verify how the migration realizes the enum — likely a CHECK constraint or text column rebuild; if it's a table rebuild, confirm the copy is lossless in the SQL before applying.) |
| 2 | `src/lib/srs/types.ts` | `export type SRSAlgorithmType = "SM2" | "LEITNER" | "FSRS";` |
| 3 | `src/lib/srs/index.ts` | Add `FSRS: new FSRSAlgorithm()` to the registry, `"FSRS"` to `SRS_ALGORITHMS`, export the class. |
| 4 | `src/lib/validation.ts` | `settingsSchema.preferredAlgorithm: z.enum(["SM2","LEITNER","FSRS"])`. |
| 5 | `src/components/settings/SettingsForm.tsx` | Extend the local `Algorithm` type and the options array with FSRS (label + one-line description). |
| 6 | (optional, Phase 3) `desiredRetention` setting | Separate row in Phase 3 — do not bundle. |

The review route needs **no change**: `getAlgorithm(user.preferredAlgorithm)` picks FSRS up automatically, and `ReviewLog.algorithm` will record `FSRS` for free.

### GATE: lossless switching test (write this exactly)

Add to `src/lib/srs/__tests__/fsrs.test.ts` (or a new `switching.test.ts`):

```ts
it("SM2 → FSRS → SM2 loses nothing", () => {
  // 1. Run 3 SM-2 reviews (q=4) from initialState; snapshot easeFactor,
  //    repetitions, box, lapses, intervalDays.
  // 2. Feed the resulting state into FSRSAlgorithm.calculateNextReview(q=4).
  //    Assert: next.easeFactor === prior easeFactor, next.box === prior box
  //    (FSRS must not touch them), srsData.fsrs now present.
  // 3. Feed THAT state back into SM2Algorithm (q=4).
  //    Assert: SM-2 behaves as if uninterrupted w.r.t. easeFactor math,
  //    and next.srsData.fsrs is still present (spread-through, not dropped).
});
```

Also verify manually: with a dev DB, set FSRS in Settings UI, review one card, switch back to SM2, review again — no 500s, `srsData` intact, `ReviewLog` rows show algorithm FSRS then SM2. **If easeFactor or srsData is clobbered** → the FSRS engine is overwriting fields it shouldn't; fix the engine, not the route.

Exit: migration applied cleanly on a copy of a real dev DB, `npm test` + `npm run build` green, switching test green.

---

## Phase 3 — Modifier-layer interaction (DECISION GATE for the owner)

`applyUserModifiers` will run on FSRS output automatically. Decide and document each knob:

| Knob | Recommendation | Rationale |
|------|----------------|-----------|
| `desiredRetention` (NEW) | Add as FSRS-specific User setting, Float, default **0.90**, Zod range 0.70-0.97. Follow the add-a-setting checklist in `recall-config-and-settings` (schema column additive-default → validation.ts → settings route selects → SettingsForm → engine reads it). Engine must receive it — since `calculateNextReview` has no prefs parameter, pass it via constructor/config when building the registry entry, or read from a per-call options object; do NOT widen the shared interface without change control. Simplest interface-preserving option: registry builds `new FSRSAlgorithm()` with default 0.9 and the route wraps it — flag the exact mechanism as part of this gate's decision. |
| `intervalModifier` | Arguably redundant with desiredRetention (both scale intervals). Recommendation: leave it applying (consistency, and default is 1.0 so it's a no-op) but document in the settings UI copy that FSRS users should prefer desiredRetention. |
| `fuzzIntervals` | Keep applying. Harmless ±5%; FSRS canon also fuzzes. |
| `masteryThresholdDays` | Keep applying. It's a product feature, not scheduler math. |
| `lapseModifier` | Keep applying (default 0.0 = off). Note it fights FSRS's own lapse-stability formula when enabled — document, don't block. |

**Owner sign-off required** on this table before Phase 3 code lands. If the owner instead wants FSRS exempt from some modifiers → the clean seam is a capability flag on the strategy (e.g. `readonly respectsIntervalModifier`) checked in `applyUserModifiers` — that widens the interface, so route through `recall-change-control`.

Gate: modifiers test extended to cover an FSRS-shaped result (fuzz determinism via injected rng, mastery promotion at threshold). Tests + build green.

---

## Phase 4 — Optional: parameter fitting from ReviewLog (research phase)

Only after Phases 1-3 are live and stable. This is `recall-research-program` territory; summary here:

- **Input**: `ReviewLog` rows per user (quality 0-5 → FSRS grades via the Phase 0 mapping, reviewedAt deltas per wordId). The log already has everything needed: per-card ordered grade history with timestamps.
- **Minimum volume**: canon (fsrs4anki wiki, dated claim as of 2026-07-07 — re-verify) recommends on the order of **~1000+ reviews** before fitted weights beat defaults; below that, use defaults. Hard-fence: refuse to fit under the threshold.
- **Mechanism**: offline script (scratchpad or `scripts/`), export logs, fit with py-fsrs's optimizer or `fsrs-rs`/`fsrs-optimizer`; store fitted weights per user in `User.settings` JSON (already exists, `Json?`) — additive, no migration.
- **Falsifiable success milestone**: on a held-out 20% suffix of the user's log, fitted-parameter FSRS achieves lower log-loss / RMSE(bins) predicting recall (q>=3 as success) than default-parameter FSRS. If it doesn't, ship defaults and record the negative result. Never ship fitted weights judged "by feel".

---

## Validation & promotion protocol

Route the whole campaign through `recall-change-control` (schema migration + scheduler change = highest gate class). Promotion criteria — all measurable, none judged by eye:

1. FSRS unit trajectories match py-fsrs reference values within tolerance (|Δinterval| <= 1% or 0.01d, whichever is larger).
2. Full `npm test` green (existing sm2/leitner/modifiers suites untouched and passing — zero edits to their expectations).
3. `npm run build` green.
4. Switching test (Phase 2 gate) green.
5. Playwright E2E journey passes with `preferredAlgorithm = FSRS` selected (extend the E2E per `recall-validation-and-qa`).
6. Migration verified lossless on a copy of a production-shaped SQLite file (row counts and spot-checked rows identical apart from the enum's new legal value).

## Known wrong paths — fenced off

- **Do NOT add FSRS columns (difficulty/stability) to UserProgress.** `srsData Json?` exists precisely for this; the schema comment says so. Columns = migration risk for zero benefit.
- **Do NOT repurpose `easeFactor` to store FSRS difficulty.** It breaks lossless switching back to SM-2 and lies to every stats/UI reader of that field.
- **Do NOT skip the grade-mapping decision (Phase 0.3)** or bury it implicitly in code. It changes every interval FSRS ever produces.
- **Do NOT fit parameters on tiny logs** (< ~1000 reviews) or without the held-out-suffix test. Defaults are the fallback, always.
- **Do NOT type FSRS weight vectors or constants from memory** — copy from py-fsrs and pin the version.
- **Do NOT let the engine set MASTERED or emit custom dueAt** — the modifier layer owns both.
- **Do NOT edit ReviewLog rows or re-scale historical quality values.** Append-only, forever.

## Provenance and maintenance

Repo facts verified 2026-07-07 against commit e8f06ed. Re-verify before executing:

- Interface: `cat "src/lib/srs/types.ts"`
- Registry/modifiers: `cat src/lib/srs/index.ts src/lib/srs/modifiers.ts`
- Review route: `cat "src/app/api/study/review/route.ts"`
- Schema fields: `grep -n "srsData\|preferredAlgorithm\|SRSAlgorithmType" prisma/schema.prisma`
- Quality emitters: `grep -rn "QUALITY_BY_DIRECTION\|postReview(" src/`
- Settings surface: `grep -n "preferredAlgorithm" src/lib/validation.ts src/components/settings/SettingsForm.tsx`
- External canon: fsrs4anki wiki "The Algorithm" + open-spaced-repetition/py-fsrs `DEFAULT_PARAMETERS` — fetch fresh at implementation time; all FSRS math above is labeled external canon and must be diffed against them.
