/**
 * Pure logic for building the vendored sentence seed data
 * (prisma/data/hsk/sentences.json) from Tatoeba-derived zh↔en pairs.
 * CLI wrapper: scripts/generate-sentences.ts. Kept in src/lib so the
 * segmentation and selection rules are unit-testable.
 */

export type SeedSentence = {
  text: string;
  translation: string;
  source: string;
  /** Distinct vocabulary terms the sentence exercises (SentenceWord links). */
  terms: string[];
  /** Reading/romanization (pinyin for Chinese); filled by the pinyin pass. */
  phonetic?: string;
  metadata: { level: number };
};

/**
 * Only CJK ideographs need vocabulary coverage; punctuation, digits, latin
 * text, and other symbols are ignorable.
 */
const NEEDS_COVERAGE = /[㐀-鿿豈-﫿]/;

/**
 * Greedy longest-match segmentation against a known vocabulary. Returns the
 * distinct matched terms, or null when any non-ignorable run of characters
 * cannot be covered — i.e. the sentence uses words outside the vocabulary.
 */
export function segment(
  text: string,
  vocab: Map<string, number>,
  maxTermLength: number
): string[] | null {
  const matched = new Set<string>();
  let i = 0;
  while (i < text.length) {
    if (!NEEDS_COVERAGE.test(text[i])) {
      i += 1;
      continue;
    }
    let match: string | null = null;
    for (let len = Math.min(maxTermLength, text.length - i); len >= 1; len--) {
      const candidate = text.slice(i, i + len);
      if (vocab.has(candidate)) {
        match = candidate;
        break;
      }
    }
    if (!match) return null;
    matched.add(match);
    i += match.length;
  }
  return matched.size > 0 ? [...matched] : null;
}

export type PairInput = {
  translation: string; // English side
  text: string; // Chinese side
  source: string; // per-line attribution
};

/**
 * Pick seed sentences: fully covered by the vocabulary, shortest first, at
 * most `perWord` sentences per exercised word and `total` overall. The level
 * stamped on a sentence is the highest HSK level among its words (reading
 * difficulty), with vocabulary levels supplied via `vocab` (term → level,
 * 0 = frequency-list-only word treated as unleveled).
 */
export function selectSentences(
  pairs: PairInput[],
  vocab: Map<string, number>,
  { perWord = 3, total = 3000, maxChars = 32 }: { perWord?: number; total?: number; maxChars?: number } = {}
): SeedSentence[] {
  const maxTermLength = Math.max(1, ...[...vocab.keys()].map((t) => t.length));
  const seen = new Set<string>();
  const candidates: { pair: PairInput; terms: string[]; level: number }[] = [];

  for (const pair of pairs) {
    const text = pair.text.trim();
    if (!text || text.length > maxChars || seen.has(text)) continue;
    const terms = segment(text, vocab, maxTermLength);
    if (!terms) continue;
    seen.add(text);
    const level = Math.max(...terms.map((t) => vocab.get(t) ?? 0));
    candidates.push({ pair: { ...pair, text }, terms, level });
  }

  candidates.sort((a, b) => a.pair.text.length - b.pair.text.length);

  const perWordCount = new Map<string, number>();
  const out: SeedSentence[] = [];
  for (const c of candidates) {
    if (out.length >= total) break;
    const useful = c.terms.some((t) => (perWordCount.get(t) ?? 0) < perWord);
    if (!useful) continue;
    for (const t of c.terms) perWordCount.set(t, (perWordCount.get(t) ?? 0) + 1);
    out.push({
      text: c.pair.text,
      translation: c.pair.translation.trim(),
      source: c.pair.source.trim(),
      terms: c.terms,
      metadata: { level: c.level },
    });
  }
  return out;
}
