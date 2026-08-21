/**
 * Grading (verification) pass for Reading Mode stories.
 *
 * Closes the authoring loop: the LLM proposes, this grader verifies. A story
 * PASSES for its target level when:
 *   - ≤5% of word tokens sit ABOVE that level (the ceiling — original check)
 *   - enough distinct lemmas sit AT that level (the floor — MIN_AT_LEVEL_LEMMAS,
 *     catches stories that are secretly two levels too easy)
 *   - the body falls within LENGTH_SPEC for that level (catches vignettes
 *     masquerading as full graded readers)
 * Anything else is FLAGGED with the offending lemmas/reasons for human review.
 *
 * Pure — no I/O. `segmentText` output in, `GradeReport` out.
 */

import type { GradeReport, StoryToken } from "./types";

export const ABOVE_LEVEL_LIMIT = 0.05;
/** Words new at the target band should repeat at least this often (warning only). */
export const MIN_REPETITIONS = 3;
/** Comfortable learner reading speed for graded prose (chars/min, low levels). */
export const CHARS_PER_MINUTE = 150;

/**
 * Minimum distinct lemmas that must sit exactly at the target band. Level 1
 * is exempt (0) — at HSK1 essentially all vocabulary IS the target band, so a
 * floor is meaningless there. Calibrated against the 2026-08-21 content
 * review: a genuinely on-level HSK3 story had 18 at-band lemmas; a story
 * mislabeled two levels too easy had 2.
 */
export const MIN_AT_LEVEL_LEMMAS: Record<number, number> = {
  1: 0,
  2: 5,
  3: 10,
  4: 12,
  5: 15,
  6: 15,
  7: 15,
};

/** [min, max] CJK character count per level. 1–3 from docs/content/gemini-prompt.md; 4+ extend that spec. */
export const LENGTH_SPEC: Record<number, [number, number]> = {
  1: [80, 200],
  2: [200, 400],
  3: [400, 800],
  4: [600, 1000],
  5: [800, 1200],
  6: [900, 1400],
  7: [1000, 1600],
};

function cjkLength(tokens: StoryToken[]): number {
  let n = 0;
  for (const t of tokens) if (!t.isPunct) n += Array.from(t.w).length;
  return n;
}

export function gradeTokens(
  tokens: StoryToken[],
  targetLevel: number,
  now: Date = new Date()
): GradeReport {
  const words = tokens.filter((t) => !t.isPunct);

  const perLemma = new Map<string, { lvl: number | null; count: number }>();
  let aboveTokens = 0;
  const bandHistogram: Record<string, number> = {};

  for (const t of words) {
    const found = perLemma.get(t.w);
    if (found) {
      found.count++;
    } else {
      perLemma.set(t.w, { lvl: t.lvl, count: 1 });
      const key = t.lvl === null ? "off" : String(t.lvl);
      bandHistogram[key] = (bandHistogram[key] ?? 0) + 1;
    }
    if (t.lvl !== null && t.lvl > targetLevel) aboveTokens++;
  }

  const aboveLevel: GradeReport["aboveLevel"] = [];
  const offList: GradeReport["offList"] = [];
  const lowRepetition: GradeReport["lowRepetition"] = [];
  let atLevelUnique = 0;
  for (const [lemma, { lvl, count }] of perLemma) {
    if (lvl !== null && lvl > targetLevel) aboveLevel.push({ lemma, lvl, count });
    if (lvl === null) offList.push({ lemma, count });
    if (lvl === targetLevel) {
      atLevelUnique++;
      if (count < MIN_REPETITIONS) lowRepetition.push({ lemma, count });
    }
  }
  aboveLevel.sort((a, b) => b.count - a.count);
  offList.sort((a, b) => b.count - a.count);
  lowRepetition.sort((a, b) => b.count - a.count);

  // Sentence lengths (CJK chars per sentence, empty sentences skipped)
  const lens: number[] = [];
  let cur = 0;
  for (const t of tokens) {
    if (t.isPunct) {
      if (SENTENCE_TEST.test(t.w) && cur > 0) {
        lens.push(cur);
        cur = 0;
      }
      continue;
    }
    cur += Array.from(t.w).length;
  }
  if (cur > 0) lens.push(cur);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const max = lens.length ? Math.max(...lens) : 0;

  const total = words.length;
  const aboveLevelPct = total > 0 ? aboveTokens / total : 0;
  const chars = cjkLength(tokens);

  const reasons: string[] = [];
  if (aboveLevelPct > ABOVE_LEVEL_LIMIT) {
    reasons.push(
      `${(aboveLevelPct * 100).toFixed(1)}% of tokens are above HSK${targetLevel} (limit ${ABOVE_LEVEL_LIMIT * 100}%)`
    );
  }
  const minAtLevel = MIN_AT_LEVEL_LEMMAS[targetLevel] ?? 0;
  if (atLevelUnique < minAtLevel) {
    reasons.push(
      `only ${atLevelUnique} distinct HSK${targetLevel} words (need at least ${minAtLevel}) — likely mislabeled too easy`
    );
  }
  const lengthSpec = LENGTH_SPEC[targetLevel];
  if (lengthSpec) {
    const [min, max] = lengthSpec;
    if (chars < min) {
      reasons.push(`${chars} chars is below the HSK${targetLevel} length floor (${min}-${max})`);
    } else if (chars > max) {
      reasons.push(`${chars} chars is above the HSK${targetLevel} length ceiling (${min}-${max})`);
    }
  }

  return {
    targetLevel,
    verdict: reasons.length === 0 ? "pass" : "flag",
    aboveLevelPct,
    bandHistogram,
    aboveLevel,
    offList,
    lowRepetition,
    atLevelUnique,
    chars,
    reasons,
    sentenceLength: {
      avg: Math.round(avg * 10) / 10,
      max,
    },
    estimatedMin: Math.max(1, Math.ceil(chars / CHARS_PER_MINUTE)),
    gradedAt: now.toISOString(),
  };
}

const SENTENCE_TEST = /[。！？!?…；;]/;
