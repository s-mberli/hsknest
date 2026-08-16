/**
 * Structured word senses. Seeded words carry metadata.meanings as
 * [{ gloss, reading? }] (see prisma/data/hsk/README.md); user-created words
 * usually have only the joined `translation` string. These helpers give every
 * surface one consistent way to read senses, with a fallback that splits the
 * translation on "; " so older data still renders sense-by-sense.
 */

export type Meaning = {
  gloss: string;
  /** Reading when the sense belongs to a different pronunciation (e.g. 了 liǎo). */
  reading?: string;
};

type WordLike = {
  translation: string;
  metadata?: unknown;
};

function metadataMeanings(metadata: unknown): Meaning[] | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as { meanings?: unknown }).meanings;
  if (!Array.isArray(raw)) return null;
  const meanings = raw.filter(
    (m): m is Meaning =>
      !!m &&
      typeof m === "object" &&
      typeof (m as Meaning).gloss === "string" &&
      (m as Meaning).gloss.length > 0
  );
  return meanings.length > 0 ? meanings : null;
}

/**
 * All senses of a word: metadata.meanings when present, otherwise the
 * translation split on "; ". Always returns at least one entry (the raw
 * translation) for non-empty translations.
 */
export function parseMeanings(word: WordLike): Meaning[] {
  const structured = metadataMeanings(word.metadata);
  if (structured) return structured;
  const parts = word.translation
    .split(/;\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return [{ gloss: word.translation }];
  return parts.map((gloss) => ({ gloss }));
}

/** The single most important gloss — for quiz choices, tables, tooltips. */
export function primaryGloss(word: WordLike): string {
  return parseMeanings(word)[0]?.gloss ?? word.translation;
}

/**
 * Short game-surface gloss (quiz options, match tiles, ninja prompts): the
 * primary gloss with parentheticals stripped.
 *
 * Rules, in order:
 * 1. If fully wrapped: "(xyz)" → "xyz"
 * 2. Strip trailing parenthetical: "abc (xyz)" → "abc"
 * 3. Strip leading parenthetical: "(xyz) abc" → "abc"
 * 4. Cut at word boundary if longer than max.
 */
export function gameGloss(word: WordLike, max = 40): string {
  let gloss = primaryGloss(word).trim();

  // Fully wrapped
  const wrapped = gloss.match(/^\((.+)\)$/);
  if (wrapped) {
    gloss = wrapped[1].trim();
  } else {
    // Strip trailing parenthetical
    gloss = gloss.replace(/\s*\([^()]*\)\s*$/, "").trim();
    // If result was all parens, recover original; otherwise strip leading parens
    if (gloss.length === 0) {
      gloss = primaryGloss(word).trim();
    } else {
      // Strip leading parenthetical
      gloss = gloss.replace(/^\s*\([^()]*\)\s*/, "").trim() || gloss;
    }
  }

  if (gloss.length <= max) return gloss;
  const cut = gloss.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
