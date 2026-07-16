/** Study-card text scale, a per-account setting (`User.cardTextSize`). */
export type CardTextSize = "small" | "normal" | "large";

/**
 * Tailwind classes per card element for each size step. `phonetic` is the
 * prominent reading shown with the answer (a primary recall target);
 * `phoneticHint` is the small muted reading used elsewhere (secondary senses).
 */
export const CARD_TEXT_CLASSES: Record<
  CardTextSize,
  {
    term: string;
    phonetic: string;
    phoneticHint: string;
    translation: string;
    secondaryMeaning: string;
  }
> = {
  small: {
    term: "text-4xl sm:text-5xl",
    phonetic: "text-lg",
    phoneticHint: "text-base",
    translation: "text-lg sm:text-xl",
    secondaryMeaning: "text-xs",
  },
  normal: {
    term: "text-5xl sm:text-6xl",
    phonetic: "text-xl sm:text-2xl",
    phoneticHint: "text-lg",
    translation: "text-xl sm:text-2xl",
    secondaryMeaning: "text-sm",
  },
  large: {
    term: "text-6xl sm:text-7xl",
    phonetic: "text-2xl sm:text-3xl",
    phoneticHint: "text-xl",
    translation: "text-2xl sm:text-3xl",
    secondaryMeaning: "text-base",
  },
};

export function normalizeCardTextSize(value: unknown): CardTextSize {
  return value === "small" || value === "large" ? value : "normal";
}

// Term size ladder from smallest to largest; each CardTextSize starts at a
// base rung and long terms step down so a single word never has to break
// mid-word ("die Schwester" must wrap as words, not as "Schweste|r").
const TERM_SIZE_LADDER = [
  "text-2xl sm:text-3xl",
  "text-3xl sm:text-4xl",
  "text-4xl sm:text-5xl",
  "text-5xl sm:text-6xl",
  "text-6xl sm:text-7xl",
] as const;

const TERM_BASE_RUNG: Record<CardTextSize, number> = {
  small: 2,
  normal: 3,
  large: 4,
};

/**
 * Size class for a card's term, stepped down when its longest word is long
 * (alphabetic vocab — German compounds, phrases). CJK terms are short and
 * keep the base size.
 */
export function termSizeClass(term: string, size: CardTextSize): string {
  const longestWord = term
    .split(/\s+/)
    .reduce((max, w) => Math.max(max, w.length), 0);
  const stepDown = longestWord > 12 ? 2 : longestWord > 7 ? 1 : 0;
  return TERM_SIZE_LADDER[Math.max(0, TERM_BASE_RUNG[size] - stepDown)];
}
