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

import { pinyin as pinyinPro } from "pinyin-pro";

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
 * Characters where the pinyin tiebreak (`preferredReading`) would pick the
 * wrong sense, so the dataset's own relative order among ORDINARY forms is
 * trusted instead. Two distinct reasons a character lands here — both
 * verified by hand against the raw dataset; extend only after checking the
 * specific forms:
 *   - Genuine dual-reading words where both sides are common (地 de "-ly" vs
 *     dì "earth"; 教 jiāo "to teach" vs jiào "religion") — pinyin-pro's
 *     dictionary-frequency default disagrees with the HSK-taught sense.
 *   - Same reading, wrong sense (只 has a common zhī "classifier for birds…"
 *     form AND a marginal zhī "grain that has begun to ripen" form — the
 *     tiebreak can't distinguish them since both match the preferred
 *     reading; it's a coincidence of the dataset's form order, not a ranking
 *     bug per se).
 * Surname/marginal demotion below still applies — this only skips the
 * pinyin-preference nudge among forms that survive it.
 */
const PRESERVE_DATASET_ORDER = new Set(["地", "教", "只"]);

/**
 * A form's glosses are "marginal" when its most common gloss markers signal
 * archaic, dialectal, regional, or loanword usage — the kind of sense an HSK
 * learner never needs, as opposed to a second common reading (地, 教).
 */
const MARGINAL_GLOSS =
  /\((archaic|dialect|literary|loanword[^)]*|Tw\)|Taiwan pr\.[^)]*)\)/i;

function isMarginalForm(glosses: string[]): boolean {
  return glosses.length > 0 && glosses.every((g) => MARGINAL_GLOSS.test(g));
}

/**
 * Order an entry's forms so the one with ordinary (learnable, non-surname)
 * senses — and the commonly-taught reading — leads. Two failure modes this
 * guards against, both seen in complete-hsk-vocabulary:
 *   1. Proper-noun-first entries (三 leads with "Sān / surname San", hiding
 *      "three" in the second form).
 *   2. Rare-reading-first entries (说 leads with "shuì / to persuade" ahead
 *      of the everyday "shuō / to speak" — a lone archaic/marginal sense
 *      that happened to sort first in the source data).
 * Both would otherwise become the card's primary sense and audio reading.
 * Genuine dual-reading words where both sides are common (PRESERVE_DATASET_
 * ORDER) are left exactly as the dataset has them. Stable: forms tied on
 * every score keep their source order.
 */
export function rankForms(forms: RawForm[], term?: string): RawForm[] {
  const skipPinyinTiebreak = !!term && PRESERVE_DATASET_ORDER.has(term);
  const preferred = term && !skipPinyinTiebreak ? preferredReading(term) : null;
  const score = (f: RawForm) => {
    const kept = f.meanings.map((m) => m.trim()).filter((m) => m && !NOISE_GLOSS.test(m));
    if (!kept.some((m) => !SURNAME_GLOSS.test(m))) return 2; // surname-only
    const ordinary = kept.filter((m) => !SURNAME_GLOSS.test(m));
    if (isMarginalForm(ordinary)) return 1; // real but marginal sense
    if (preferred && normReading(f.transcriptions.pinyin) !== preferred) return 0.5;
    return 0;
  };
  return [...forms].sort((a, b) => score(a) - score(b));
}

function normReading(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * The commonly-taught reading for `term`, via pinyin-pro. Single characters:
 * take the first of pinyin-pro's ranked alternatives (its "best single guess"
 * mode disagrees with the ranked list for at least one common case, 了 →
 * "liǎo" instead of "le" — the ranked list gets it right). Multi-character
 * terms: pinyin-pro resolves polyphones from dictionary/context (银行 → háng,
 * not xíng), so its single-answer mode is already correct there.
 */
function preferredReading(term: string): string {
  if ([...term].length === 1) {
    return normReading(pinyinPro(term, { toneType: "symbol", multiple: true }).split(" ")[0]);
  }
  return normReading(pinyinPro(term, { toneType: "symbol", multiple: false }));
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
export function buildMeanings(forms: RawForm[], term?: string): SeedMeaning[] {
  const ranked = rankForms(forms, term);
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
  const primary = rankForms(entry.forms, entry.simplified)[0];
  const meanings = buildMeanings(entry.forms, entry.simplified);
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
