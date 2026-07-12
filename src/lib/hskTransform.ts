/**
 * Pure transforms for building the vendored HSK seed JSONs
 * (prisma/data/hsk/*.json) from the complete-hsk-vocabulary dataset
 * (https://github.com/drkameleon/complete-hsk-vocabulary, MIT).
 *
 * Kept in src/lib so the logic is unit-testable; the CLI wrapper lives in
 * scripts/generate-hsk-data.ts. Language-agnostic on the way out: seed words
 * are { term, translation, phonetic, metadata } with structured senses in
 * metadata.meanings as [{ gloss, reading? }].
 */

export type RawForm = {
  traditional: string;
  transcriptions: { pinyin: string };
  meanings: string[];
};

export type RawEntry = {
  simplified: string;
  level: string[];
  frequency?: number;
  pos?: string[];
  forms: RawForm[];
};

export type SeedMeaning = {
  gloss: string;
  /** Reading when it differs from the word's primary phonetic (e.g. 了 liǎo). */
  reading?: string;
};

export type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: {
    level: number;
    pos?: string[];
    frequencyRank?: number;
    traditional?: string;
    meanings: SeedMeaning[];
  };
};

/** Rank for ordering words within a list; unknown frequency sinks to the end. */
export const UNKNOWN_RANK = 1000000;

/** Glosses that are dictionary cross-references, not learnable senses. */
const NOISE_GLOSS =
  /^(variant of|old variant of|unofficial variant|archaic variant|used in |see )/i;
const SURNAME_GLOSS = /^surname /i;

/** Drop cross-reference noise; drop surname senses unless nothing else is left. */
export function cleanGlosses(meanings: string[]): string[] {
  const kept = meanings.map((m) => m.trim()).filter((m) => m && !NOISE_GLOSS.test(m));
  const nonSurname = kept.filter((m) => !SURNAME_GLOSS.test(m));
  return nonSurname.length > 0 ? nonSurname : kept;
}

/**
 * Order an entry's forms so the one with ordinary (learnable, non-surname)
 * senses leads. Some dictionary entries list a proper-noun reading first —
 * e.g. 三 leads with "Sān / surname San" and hides "three" in the second
 * form — which would otherwise become the card's primary sense and phonetic.
 * Stable: forms with equal scores keep their source order.
 */
export function rankForms(forms: RawForm[]): RawForm[] {
  const score = (f: RawForm) => {
    const kept = f.meanings.map((m) => m.trim()).filter((m) => m && !NOISE_GLOSS.test(m));
    return kept.some((m) => !SURNAME_GLOSS.test(m)) ? 0 : 1;
  };
  return [...forms].sort((a, b) => score(a) - score(b));
}

/** Hard cap on stored senses per word — beyond this it's dictionary noise. */
const MAX_MEANINGS = 8;

/**
 * Short, card-friendly primary translation: the first senses of the primary
 * form joined with "; ", stopping once ~60 chars are used (always ≥ 1 sense,
 * at most 3).
 */
export function buildTranslation(glosses: string[]): string {
  const parts: string[] = [];
  for (const g of glosses.slice(0, 3)) {
    if (parts.length > 0 && parts.join("; ").length + g.length + 2 > 60) break;
    parts.push(g);
  }
  if (parts.length === 0 && glosses.length > 0) parts.push(glosses[0]);
  return parts.join("; ");
}

/**
 * Flatten an entry's forms into a structured meanings list. The primary form
 * (first) contributes plain glosses; other forms contribute glosses tagged
 * with their reading so e.g. 了 shows "le" senses first and "liǎo" senses
 * marked as such. Duplicate glosses are dropped.
 */
export function buildMeanings(forms: RawForm[]): SeedMeaning[] {
  const ranked = rankForms(forms);
  const primaryPinyin = ranked[0]?.transcriptions.pinyin;
  const out: SeedMeaning[] = [];
  const seen = new Set<string>();
  for (const form of ranked) {
    const reading = form.transcriptions.pinyin;
    for (const gloss of cleanGlosses(form.meanings)) {
      const key = `${reading}|${gloss.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(reading === primaryPinyin ? { gloss } : { gloss, reading });
    }
  }
  // Ordinary senses first, proper-noun senses last, capped: a learner wants
  // "three", not "surname San", as the face of 三.
  const ordinary = out.filter((m) => !SURNAME_GLOSS.test(m.gloss));
  const surnames = out.filter((m) => SURNAME_GLOSS.test(m.gloss));
  return [...ordinary, ...surnames].slice(0, MAX_MEANINGS);
}

/** Transform one raw dataset entry into a seed word for the given HSK level (0 = frequency list). */
export function transformEntry(entry: RawEntry, level: number): SeedWord {
  const primary = rankForms(entry.forms)[0];
  const meanings = buildMeanings(entry.forms);
  const primaryGlosses = cleanGlosses(primary.meanings);
  const traditional =
    primary.traditional && primary.traditional !== entry.simplified
      ? primary.traditional
      : undefined;
  return {
    term: entry.simplified,
    translation: buildTranslation(
      primaryGlosses.length > 0 ? primaryGlosses : meanings.map((m) => m.gloss)
    ),
    phonetic: primary.transcriptions.pinyin,
    metadata: {
      level,
      ...(entry.pos && entry.pos.length > 0 ? { pos: entry.pos } : {}),
      ...(entry.frequency ? { frequencyRank: entry.frequency } : {}),
      ...(traditional ? { traditional } : {}),
      meanings,
    },
  };
}

/** Words for one HSK 3.0 level ("new-N" tags), ordered by frequency. */
export function buildLevel(data: RawEntry[], level: number): SeedWord[] {
  return data
    .filter((e) => e.level.includes(`new-${level}`) && e.forms.length > 0)
    .map((e) => transformEntry(e, level))
    .sort(
      (a, b) =>
        (a.metadata.frequencyRank ?? UNKNOWN_RANK) -
        (b.metadata.frequencyRank ?? UNKNOWN_RANK)
    );
}

/** Top-N words across the dataset by frequency rank (level stamped as 0). */
export function buildFrequencyList(data: RawEntry[], count: number): SeedWord[] {
  return data
    .filter((e) => typeof e.frequency === "number" && e.forms.length > 0)
    .sort((a, b) => (a.frequency as number) - (b.frequency as number))
    .slice(0, count)
    .map((e) => transformEntry(e, 0));
}
