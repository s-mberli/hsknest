/**
 * Shared guard against bad primary glosses — the single source of truth for
 * "what may lead a card's meanings list".
 *
 * DO NOT BYPASS: if a write "doesn't take" or seed logs [curated-guard],
 * the guard is rejecting a dictionary-plumbing or proper-noun lead on
 * purpose. Past incidents it prevents: 联想 = "Lenovo", 富裕 = a county
 * name, 威信 = a county name (see audits/hsk-gloss-audit-2026-08.md,
 * systemic finding 2). Fix the gloss order instead of weakening this guard.
 *
 * Extracted from scripts/fix-primary-glosses.ts so every writer of curated
 * data enforces the same rules:
 *   - scripts/fix-primary-glosses.ts   (generated new*.json repair)
 *   - scripts/compile-curated-glosses.ts (curated/*.json compilation)
 *   - prisma/seed.ts                    (tripwire warning at seed time)
 *
 * Conservative semantics preserved verbatim: a lead gloss is BAD when it is
 * dictionary plumbing (abbr./variant/see-/surname pointers, pure grammar
 * labels) or a proper-noun reading (leading-capital pinyin). When a bad lead
 * has a clean sibling deeper in the list, promoteCleanLead() swaps them;
 * when it doesn't (e.g. 中秋节 genuinely leading "the Mid-Autumn
 * Festival"), the list is left untouched.
 */

/** Glosses that are cross-references/plumbing, never learnable senses. */
export const META_GLOSS =
  /^(also pr\.|abbr\. for|variant of|see |old variant|used in|surname |CL:|erhua variant|old form of|see also)/i;

/** Whole gloss is nothing but a grammar label, e.g. "(adverb of degree)". */
export const PURE_LABEL_GLOSS =
  /^\((adverb|specifier|classifier|prefix|modal particle|question particle|particle)[^)]*\)$/i;

/**
 * A leading uppercase letter in pinyin ⇒ CC-CEDICT proper-noun sense (Xīn,
 * Rì, Zhōng…). Readings are otherwise lowercase, so first-letter case is the
 * signal — Unicode-aware so accented capitals (Ā níng, À…) count too.
 */
export function isProperNounReading(reading?: string): boolean {
  return !!reading && /\p{Lu}/u.test(reading[0]);
}

/** Normalize a reading for pronunciation comparison (case + spacing only). */
export function normReading(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export type GuardedGloss = { gloss: string; reading?: string };

/** A lead gloss unfit to be the face of the card. */
export function isBadLead(m: GuardedGloss, cardPhonetic?: string): boolean {
  if (META_GLOSS.test(m.gloss)) return true;
  if (PURE_LABEL_GLOSS.test(m.gloss.trim())) return true;
  return isProperNounReading(m.reading ?? cardPhonetic);
}

/**
 * Real lexical content once a leading "(...)" qualifier is stripped — AND the
 * sense shares the pronunciation the card teaches (a different-reading sense
 * is a different word on the same characters; promoting it would mis-teach
 * the reading and flip the audio logic). Capitalization-only differences
 * (Xīn vs xīn) count as the same pronunciation.
 */
export function isCleanSense(m: GuardedGloss, cardPhonetic?: string): boolean {
  if (META_GLOSS.test(m.gloss)) return false;
  if (PURE_LABEL_GLOSS.test(m.gloss.trim())) return false;
  const reading = m.reading ?? cardPhonetic;
  if (isProperNounReading(reading)) return false;
  if (cardPhonetic && reading && normReading(reading) !== normReading(cardPhonetic))
    return false;
  const stripped = m.gloss.replace(/^\([^)]*\)\s*/, "").trim();
  return stripped.length > 0;
}

/**
 * Demote a bad lead gloss when a clean sibling exists deeper in the list.
 * Returns the (possibly reordered) array and whether anything moved.
 * No-op when the lead is fine or no clean alternative exists.
 */
export function promoteCleanLead<T extends GuardedGloss>(
  meanings: T[],
  cardPhonetic?: string
): { meanings: T[]; changed: boolean } {
  if (meanings.length < 2) return { meanings, changed: false };
  if (!isBadLead(meanings[0], cardPhonetic)) return { meanings, changed: false };
  const idx = meanings.findIndex((m) => isCleanSense(m, cardPhonetic));
  if (idx <= 0) return { meanings, changed: false };
  const out = [...meanings];
  const [good] = out.splice(idx, 1);
  out.unshift(good);
  return { meanings: out, changed: true };
}
