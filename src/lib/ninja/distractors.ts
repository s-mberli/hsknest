/**
 * Distractor selection: frequency-matched when the data supports it,
 * POS-matched as a fallback, random as the last resort.
 * Works client-side from the queue card's metadata (which includes POS tags
 * and HSK frequency rank).
 */

export interface NinjaWord {
  wordId: string;
  term: string; // the hanzi
  translation: string;
  phonetic?: string; // space-separated syllables with tone marks (e.g. "wǒ men")
  pos?: string[]; // part of speech tags from metadata.pos
  /** HSK frequency rank from metadata.frequencyRank — lower is more common.
   * Optional: callers without this data (or older tests) fall back to the
   * POS-only picker below, unchanged. */
  frequencyRank?: number;
  /** Word list id + position within it — used as a free topical-similarity
   * signal (same list / nearby position ≈ same lesson, likely confusable). */
  wordListId?: string;
  listPosition?: number;
}

/**
 * Pick N distractor words from a pool. Never returns the target word itself.
 *
 * When `target.frequencyRank` is available, ranks candidates by closeness in
 * (log) frequency rank — a random word is eliminable on vibes ("that one's
 * obviously wrong"), a frequency peer usually isn't, which is the whole
 * point of a distractor. POS agreement is folded in as a *weak* tiebreak
 * only (metadata.pos tags are multi-valued and noisy — see
 * recall-architecture-contract) rather than the primary signal.
 *
 * Without frequency data (older callers, or words missing metadata), falls
 * back to the original POS-primary, random-secondary picker.
 *
 * @param target The word being asked
 * @param pool Available words (typically 10–50 from the session queue)
 * @param rng Random number generator (seeded for determinism)
 * @param count Number of distractors to pick (default 3)
 * @param closeness 0=loose frequency match (today's default, existing tests
 *   depend on this), 1=tightest — shrinks the sampling window and weighs
 *   orthographic/topical similarity more heavily as it rises. Driven by
 *   src/lib/ninja/difficulty.ts's adaptive level.
 * @returns Array of up to `count` unique distractor words (fewer if the pool is thin)
 */
export function pickDistractors(
  target: NinjaWord,
  pool: NinjaWord[],
  rng: () => number,
  count: number = 3,
  closeness: number = 0
): NinjaWord[] {
  const available = pool.filter((w) => w.term !== target.term);
  if (available.length === 0) return [];

  return target.frequencyRank != null
    ? pickByFrequency(target, available, rng, count, closeness)
    : pickByPos(target, available, rng, count);
}

/** Shared characters (CJK) or short edit distance (Latin scripts) — a cheap
 * orthographic-confusability proxy. Higher = more visually/spelling similar. */
function orthographicSimilarity(a: string, b: string): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const ch of setA) if (setB.has(ch)) shared += 1;
  if (shared > 0) return shared / Math.max(setA.size, setB.size);

  // No shared characters — fall back to normalized edit distance for
  // Latin-script terms (German etc.), where confusability is spelling-based
  // rather than glyph-sharing.
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return Math.max(0, 1 - dist / maxLen);
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(i === 0 ? 0 : 0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Same word list and a nearby position ≈ same lesson/topic — words taught
 * together are the ones a learner is likeliest to actually confuse. */
function topicalSimilarity(target: NinjaWord, candidate: NinjaWord): number {
  if (!target.wordListId || target.wordListId !== candidate.wordListId) return 0;
  if (target.listPosition == null || candidate.listPosition == null) return 0.5; // same list, unknown position
  const gap = Math.abs(target.listPosition - candidate.listPosition);
  return Math.max(0, 1 - gap / 20);
}

/**
 * Frequency-ranked picker. Sorts by |log(rank) − log(targetRank)| (POS
 * match as a weak tiebreak), then randomly samples `count` from a window of
 * the nearest candidates so distractors aren't the literal same neighbours
 * every time the word comes up. As `closeness` rises, the window shrinks
 * (favoring the tightest frequency neighbours) and orthographic/topical
 * similarity get folded into the sort so distractors are genuinely
 * confusable, not just equally common.
 */
function pickByFrequency(
  target: NinjaWord,
  available: NinjaWord[],
  rng: () => number,
  count: number,
  closeness: number
): NinjaWord[] {
  const targetPos = new Set(target.pos || []);
  const targetLogRank = Math.log(target.frequencyRank!);

  // Words without their own rank sort last (Infinity distance) rather than
  // being dropped — thin-pool fallback still needs them to reach `count`.
  const scored = available.map((w) => {
    const freqDistance =
      w.frequencyRank != null ? Math.abs(Math.log(w.frequencyRank) - targetLogRank) : Infinity;
    const posMatch = (w.pos || []).some((p) => targetPos.has(p));
    const similarity = closeness > 0
      ? orthographicSimilarity(target.term, w.term) * 0.6 + topicalSimilarity(target, w) * 0.4
      : 0;
    // similarity pulls the frequency distance down (closer = smaller), scaled
    // by closeness so at closeness=0 this is byte-identical to the old sort.
    const adjustedDistance = Number.isFinite(freqDistance)
      ? freqDistance * (1 - closeness * similarity * 0.9)
      : freqDistance;
    return { word: w, distance: adjustedDistance, posMatch };
  });

  scored.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    // Equal frequency distance → nudge POS-matched candidates ahead.
    if (a.posMatch !== b.posMatch) return a.posMatch ? -1 : 1;
    return 0;
  });

  // Sample from a window of the nearest candidates — 3x the ask when loose
  // (closeness=0), tightening to 1x (no slack) at full closeness, so repeated
  // prompts don't always draw the identical set but high-difficulty waves
  // stay hard.
  const windowFactor = 3 - closeness * 2;
  const windowSize = Math.min(scored.length, Math.max(Math.round(count * windowFactor), count));
  const window = scored.slice(0, windowSize).map((s) => s.word);

  return sampleWithoutReplacement(window, rng, count);
}

/** Original POS-primary, random-secondary picker — the pre-frequency-data fallback. */
function pickByPos(
  target: NinjaWord,
  available: NinjaWord[],
  rng: () => number,
  count: number
): NinjaWord[] {
  const targetPos = new Set(target.pos || []);
  const posMatched = available.filter((w) => (w.pos || []).some((p) => targetPos.has(p)));
  const posUnmatched = available.filter((w) => !(w.pos || []).some((p) => targetPos.has(p)));

  const fromMatched = sampleWithoutReplacement(posMatched, rng, count);
  if (fromMatched.length >= count) return fromMatched;

  const seen = new Set(fromMatched.map((w) => w.term));
  const remaining = posUnmatched.filter((w) => !seen.has(w.term));
  const topUp = sampleWithoutReplacement(remaining, rng, count - fromMatched.length);

  return [...fromMatched, ...topUp];
}

/** Randomly picks up to `count` unique-by-term items from `items`, consuming `rng` per pick. */
function sampleWithoutReplacement<T extends { term: string }>(
  items: T[],
  rng: () => number,
  count: number
): T[] {
  const pool = [...items];
  const result: T[] = [];
  const seen = new Set<string>();

  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    const candidate = pool[idx];
    if (!seen.has(candidate.term)) {
      result.push(candidate);
      seen.add(candidate.term);
    }
    pool.splice(idx, 1);
  }

  return result;
}
