/** Rotatable Practice Modes. Word Ninja is deliberately not in this union. */
export type PracticeModeKey = "quiz" | "match" | "pronounce" | "sentences";

export interface PracticeAvailabilityInput {
  /** Target language code, e.g. "zh". */
  languageCode?: string | null;
  /** True when the target language has example sentences. */
  hasSentences?: boolean;
}

export interface PracticeAvailability {
  /** Modes Rotation may choose from, in stable display order. */
  rotatable: PracticeModeKey[];
  /** Word Ninja — a distinct entry point, never a rotation candidate. */
  ninja: boolean;
}

// Languages whose reading is a learnable romanization (e.g. pinyin), where a
// "pick the reading" quiz is meaningful. For IPA-based readings (de/en/es) it
// would just be "pick the phonetic spelling" — not worth quizzing, so hidden.
const ROMANIZED_READING_LANGS = new Set(["zh"]);

export const PRACTICE_MODE_LABELS: Record<PracticeModeKey, string> = {
  quiz: "Meaning Quiz",
  match: "Word Match",
  pronounce: "Reading Quiz",
  sentences: "Sentences",
};

export function getPracticeAvailability(
  input: PracticeAvailabilityInput
): PracticeAvailability {
  const rotatable: PracticeModeKey[] = [];

  // Base modes always available.
  rotatable.push("quiz", "match");

  // Language-specific: romanised reading (e.g. pinyin for zh).
  if (input.languageCode && ROMANIZED_READING_LANGS.has(input.languageCode)) {
    rotatable.push("pronounce");
  }

  // Content-dependent: example sentences.
  if (input.hasSentences) {
    rotatable.push("sentences");
  }

  return {
    rotatable,
    ninja: true, // Always available as a distinct entry point.
  };
}
