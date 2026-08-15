/**
 * Distractor selection: POS-matched when possible, random fallback.
 * Works client-side from the queue card's metadata (which includes POS tags).
 */

export interface NinjaWord {
  wordId: string;
  term: string; // the hanzi
  translation: string;
  pos?: string[]; // part of speech tags from metadata.pos
}

/**
 * Pick N distractor words from a pool, preferring those that share ≥1 POS tag
 * with the target. If the POS-matched pool is too thin, top up with random picks.
 * Never returns the target word itself.
 *
 * @param target The word being asked
 * @param pool Available words (typically 10–50 from the session queue)
 * @param rng Random number generator (seeded for determinism)
 * @param count Number of distractors to pick (default 3)
 * @returns Array of exactly `count` unique distractor words
 */
export function pickDistractors(
  target: NinjaWord,
  pool: NinjaWord[],
  rng: () => number,
  count: number = 3
): NinjaWord[] {
  // Filter: exclude the target itself
  const available = pool.filter((w) => w.term !== target.term);
  if (available.length === 0) return [];

  // Partition by POS match
  const targetPos = new Set(target.pos || []);
  const posMatched = available.filter((w) =>
    (w.pos || []).some((p) => targetPos.has(p))
  );
  const posUnmatched = available.filter((w) =>
    !(w.pos || []).some((p) => targetPos.has(p))
  );

  const result: NinjaWord[] = [];
  const seen = new Set<string>();

  // Take POS-matched words first
  while (result.length < count && posMatched.length > 0) {
    const idx = Math.floor(rng() * posMatched.length);
    const candidate = posMatched[idx];
    if (!seen.has(candidate.term)) {
      result.push(candidate);
      seen.add(candidate.term);
    }
    posMatched.splice(idx, 1);
  }

  // Top up with random from unmatched pool if needed
  while (result.length < count && posUnmatched.length > 0) {
    const idx = Math.floor(rng() * posUnmatched.length);
    const candidate = posUnmatched[idx];
    if (!seen.has(candidate.term)) {
      result.push(candidate);
      seen.add(candidate.term);
    }
    posUnmatched.splice(idx, 1);
  }

  return result;
}
