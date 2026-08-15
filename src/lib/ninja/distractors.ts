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
 * @returns Array of up to `count` unique distractor words (fewer if the pool is thin)
 */
export function pickDistractors(
  target: NinjaWord,
  pool: NinjaWord[],
  rng: () => number,
  count: number = 3
): NinjaWord[] {
  const available = pool.filter((w) => w.term !== target.term);
  if (available.length === 0) return [];

  return target.frequencyRank != null
    ? pickByFrequency(target, available, rng, count)
    : pickByPos(target, available, rng, count);
}

/**
 * Frequency-ranked picker. Sorts by |log(rank) − log(targetRank)| (POS
 * match as a weak tiebreak), then randomly samples `count` from a window of
 * the nearest candidates so distractors aren't the literal same neighbours
 * every time the word comes up.
 */
function pickByFrequency(
  target: NinjaWord,
  available: NinjaWord[],
  rng: () => number,
  count: number
): NinjaWord[] {
  const targetPos = new Set(target.pos || []);
  const targetLogRank = Math.log(target.frequencyRank!);

  // Words without their own rank sort last (Infinity distance) rather than
  // being dropped — thin-pool fallback still needs them to reach `count`.
  const scored = available.map((w) => {
    const distance =
      w.frequencyRank != null ? Math.abs(Math.log(w.frequencyRank) - targetLogRank) : Infinity;
    const posMatch = (w.pos || []).some((p) => targetPos.has(p));
    return { word: w, distance, posMatch };
  });

  scored.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    // Equal frequency distance → nudge POS-matched candidates ahead.
    if (a.posMatch !== b.posMatch) return a.posMatch ? -1 : 1;
    return 0;
  });

  // Sample from a window of the nearest candidates (3x the ask, or
  // everything if the pool is thinner than that) so repeated prompts for
  // the same word don't always draw the identical distractor set.
  const windowSize = Math.min(scored.length, Math.max(count * 3, count));
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
