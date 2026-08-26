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

/**
 * Tone-mark lookup for the vowel-carrying letters, index 0 = tone 1.
 * Uppercase forms are derived by case-preserving application.
 */
const TONE_MARKS: Record<string, [string, string, string, string]> = {
  a: ["ā", "á", "ǎ", "à"],
  o: ["ō", "ó", "ǒ", "ò"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

function markVowel(letter: string, tone: number): string {
  const lower = letter.toLowerCase();
  const marked = TONE_MARKS[lower]?.[tone - 1];
  if (!marked) return letter;
  return letter === lower ? marked : marked.toUpperCase();
}

/**
 * Convert one pinyin syllable from numbered/colon style ("zhe4", "lu:4",
 * "lv3") to tone-marked style ("zhè", "lǜ"). Syllables already carrying
 * tone marks (e.g. "méifǎr" fragments) or neutral-tone digits ("ge5")
 * pass through unchanged. Case is preserved ("Ya4" → "Yà").
 */
export function normalizePinyinSyllable(syllable: string): string {
  // Accept Latin + tone-marked Latin (so misplaced-mark repair below can run
  // on already-marked input); digits are the numbered-tone suffix if present.
  const m = syllable.match(/^([A-Za-z\u00C0-\u024F:üv]+)([1-5])?$/u);
  if (!m) return syllable;
  const letters = m[1].replace(/u:/gi, (s) => (s[0] === "U" ? "Ü" : "ü")).replace(/v/g, "ü");
  const tone = m[2] ? parseInt(m[2], 10) : 5;

  // Repair misplaced tone marks on -iu digraphs straight from the upstream
  // dataset (e.g. "qíu" → "qiú", "xīu" → "xiū"): the mark always falls on
  // the u, never the i. Applied before numbered-tone handling.
  let repaired = letters;
  const misplaced = repaired.match(/^(.*?)[īíǐì](u)$/i);
  if (misplaced) {
    const toneOf: Record<string, number> = { "ī": 1, "í": 2, "ǐ": 3, "ì": 4 };
    const markedChar = [...repaired][misplaced[1].length].toLowerCase();
    const toneOfMarked = toneOf[markedChar];
    if (toneOfMarked) {
      const chars = [...repaired];
      chars[misplaced[1].length] = "i"; // strip the misplaced mark
      chars[misplaced[1].length + 1] = markVowel("u", toneOfMarked);
      repaired = chars.join("");
    }
  }

  if (tone === 5) return repaired;
  const lower = letters.toLowerCase();

  // Standard mark placement: a, else o, else e, else the last vowel —
  // which also covers the i/u digraphs (mark falls on the latter: liú, guì).
  let idx: number;
  const aPos = lower.indexOf("a");
  const oPos = lower.indexOf("o");
  const ePos = lower.indexOf("e");
  if (aPos >= 0) idx = aPos;
  else if (oPos >= 0) idx = oPos;
  else if (ePos >= 0) idx = ePos;
  else {
    idx = -1;
    for (let i = lower.length - 1; i >= 0; i--) {
      if (TONE_MARKS[lower[i]]) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return letters; // no vowel — leave untouched
  }

  const chars = [...letters];
  chars[idx] = markVowel(chars[idx], tone);
  return chars.join("");
}

/**
 * Normalize any mixed-style pinyin string (word-level phonetics and per-sense
 * readings) to tone-marked form. Whitespace and apostrophe separators are
 * preserved. Idempotent on already-normalized input.
 */
export function normalizePinyin(pinyin: string): string {
  return pinyin
    .split(/(\s+|')/)
    .map((part) => (/^[\s']+$/.test(part) ? part : normalizePinyinSyllable(part)))
    .join("");
}

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
  // Normalize style (numbered/colon → tone-marked) before comparing, so
  // e.g. a "zhe4" form matches a "zhè" preferred reading.
  return normalizePinyin(s.trim()).toLowerCase();
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
 * Strip CC-CEDICT cruft from a translation: classifier notes, abbreviation
 * pointers, variant markers, Taiwan pronunciation markers, and trailing
 * place-name appositives. Preserves pedagogical context like contrast
 * references ("as opposed to 您"), "e.g.", "used with", "equivalent to".
 *
 * Examples:
 *   "spoon; ladle; CL:把[ba3]" → "spoon; ladle"
 *   "Europe (abbr. for 欧罗巴洲…)" → "Europe"
 *   "you (informal, as opposed to courteous 您)" → "you (informal, as opposed to courteous 您)"
 *   "to catch cold; Taiwan pr. [zhao1 liang2]" → "to catch cold"
 *   "rat; mouse (CL:隻|只[zhi1])" → "rat; mouse"
 */
export function stripTranslationCruft(translation: string): string {
  if (!translation) return translation;

  // Whitelist: pedagogical markers that make Han characters actually useful
  // (contrast references, examples, usage context)
  const PRESERVE = [
    /as opposed to/i,
    /equivalent to|equivalent of/i,
    /used with|used in/i,
    /namely|e\.g\./i,
  ];
  const hasPreserveMarker = PRESERVE.some((p) => p.test(translation));

  // If the translation contains a preserve marker, don't strip anything
  if (hasPreserveMarker) return translation;

  // Remove trailing segments in order of prominence
  let result = translation;

  // 1. Remove classifier cruft: "; CL:…" or "(CL:…)" with all its bracketed segments
  //    Pattern: "; CL:pinyin1[tone1],pinyin2[tone2],..." until end or next semicolon/paren
  result = result.replace(/[;,]\s*CL:[^);]*/g, "");
  result = result.replace(/\s*\(CL:[^)]*\)/gi, "");

  // 2. Remove abbreviation pointers: "(abbr. for …)" or "; abbr. for …[…]"
  result = result.replace(/\s*\(abbr\. for [^)]*\)/gi, "");
  result = result.replace(/;\s*abbr\. for [^;]*/gi, "");

  // 3. Remove variant/alternate form markers and pronunciation notes
  //    "; also written …", "; also pr. …", "Taiwan pr. […]", "coll. pr. […]"
  result = result.replace(/;\s*also (?:written|pr\.) [^;]*/gi, "");
  result = result.replace(/;\s*(?:Taiwan|coll\.) pr\. \[[^\]]*\]/gi, "");
  result = result.replace(/;\s*(?:Taiwan|coll\.) pr\. [^;]*/gi, "");

  // 4. Remove trailing place-name appositives (after a semicolon or comma)
  result = result.replace(/;\s*\w+\s+(?:county|district|city|township|prefecture)[^;]*$/gi, "");
  result = result.replace(/,\s+\w+\s+(?:county|district|township|prefecture)[^;]*$/gi, "");

  // Trim trailing whitespace and semicolons
  result = result.trim().replace(/[;,]\s*$/, "").trim();

  return result;
}

/**
 * Short, card-friendly primary translation: the first senses of the primary
 * form joined with "; ", stopping once ~60 chars are used (always ≥ 1 sense,
 * at most 3). Strips CC-CEDICT cruft before returning.
 */
export function buildTranslation(glosses: string[]): string {
  const parts: string[] = [];
  for (const g of glosses.slice(0, 3)) {
    if (parts.length > 0 && parts.join("; ").length + g.length + 2 > 60) break;
    parts.push(g);
  }
  if (parts.length === 0 && glosses.length > 0) parts.push(glosses[0]);
  const translation = parts.join("; ");
  return stripTranslationCruft(translation);
}

/**
 * Flatten an entry's forms into a structured meanings list. The primary form
 * (first) contributes plain glosses; other forms contribute glosses tagged
 * with their reading so e.g. 了 shows "le" senses first and "liǎo" senses
 * marked as such. Duplicate glosses are dropped.
 */
export function buildMeanings(forms: RawForm[], term?: string): SeedMeaning[] {
  const ranked = rankForms(forms, term);
  const primaryPinyin = normalizePinyin(ranked[0]?.transcriptions.pinyin ?? "");
  const out: SeedMeaning[] = [];
  const seen = new Set<string>();
  for (const form of ranked) {
    const reading = normalizePinyin(form.transcriptions.pinyin);
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
    // The upstream dataset mixes tone-marked, numbered ("zhe4"), and
    // colon-style ("lu:4") pinyin — normalize so every card shows marks.
    phonetic: normalizePinyin(primary.transcriptions.pinyin),
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
