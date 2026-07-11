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
