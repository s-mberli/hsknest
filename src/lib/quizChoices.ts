/**
 * Build the multiple-choice options for a quiz card: the correct answer plus
 * up to three distinct distractors drawn from a pool, all shuffled. Pure and
 * side-effect free so it's unit-testable; the queue route uses it for both the
 * meaning quiz (answers are translations) and the pronunciation quiz (answers
 * are readings).
 */
export function buildChoices(correct: string, pool: string[]): string[] {
  // Distractors: distinct, not equal to the correct answer.
  const distractors = [...new Set(pool)].filter((v) => v && v !== correct);

  // Fisher–Yates partial shuffle for the first three distractors.
  for (let i = 0; i < Math.min(3, distractors.length); i++) {
    const j = i + Math.floor(Math.random() * (distractors.length - i));
    [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
  }

  const options = [correct, ...distractors.slice(0, 3)];

  // Shuffle final order so the correct answer isn't always first.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
