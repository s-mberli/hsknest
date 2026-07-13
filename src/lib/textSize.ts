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
