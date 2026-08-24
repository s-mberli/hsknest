/**
 * Segmentation + annotation for Reading Mode.
 *
 * Pipeline (matches the deep-research consensus, adapted to this repo):
 *   1. `Intl.Segmenter("zh", { granularity: "word" })` — native ICU word
 *      segmentation; merges compounds correctly (咖啡店, 北京大学).
 *   2. `pinyin-pro` over the WHOLE text, per character — context-aware
 *      polyphone resolution (银行 xíng, 学习 xué xí) and 一/不 tone sandhi.
 *      Per-char readings are then zipped onto segment spans by char offset.
 *   3. Vocabulary cross-tag: exact lemma match against the HSK lexicon,
 *      single chars fall back to their own entry.
 *   4. Dictionary hydration: CC-CEDICT senses per lemma (exact match).
 *
 * Pure function of its inputs — safe to unit test and to run at ingest.
 */

import { pinyin } from "pinyin-pro";
import type { CedictData } from "./cedict";
import type { HskLexicon } from "./lexicon";
import type { SentenceSpan, StoryToken, TokenSense } from "./types";

const SEGMENTER = new Intl.Segmenter("zh", { granularity: "word" });

const SENTENCE_END = /[。！？!?…；;\n]/;

/** Longest HSK headwords — merge/split windows never exceed this. */
const MAX_WORD = 4;

/** True when the token is punctuation/whitespace rather than a word. */
export function isPunctToken(seg: string, isWordLike: boolean | undefined): boolean {
  if (isWordLike === false) return true;
  // Some environments mark fullwidth punctuation as word-like; double-check.
  return !/[\p{Script=Han}\p{L}\p{N}]/u.test(seg);
}

/**
 * Re-align segmenter output against the HSK lexicon:
 *   1. MERGE adjacent tokens whose concatenation IS a lexicon headword
 *      (服务|员 → 服务员, 出租|车 → 出租车) — the segmenter under-merges.
 *   2. SPLIT lexicon-miss tokens that fully decompose into lexicon
 *      headwords by greedy longest match (多少钱 → 多少|钱, 我的 → 我|的,
 *      咖啡店 → 咖啡|店) — the segmenter over-merges function phrases.
 * Tokens that neither match nor decompose stay whole (off-list).
 *
 * This is the "HSK word list as custom lexicon" strategy from the research:
 * segmentation follows the vocabulary the learner actually has.
 */
export function realignTokens(
  tokens: StoryToken[],
  lexicon: HskLexicon
): StoryToken[] {
  const out: StoryToken[] = [];

  // Pass 1 — merge runs of non-punct tokens into lexicon headwords, but only
  // when the merged headword is a BETTER (lower-band) analysis than at least
  // one of its parts. Pure concatenation matching would over-merge phrases
  // like 五|个|人 into 五|个人 ("individual", HSK5) — the band comparison
  // keeps the simple reading and still repairs 出租|车 → 出租车 (4,1 → 1)
  // and split dictionary words like 视|频 → 视频. Missing bands count as
  // infinitely high (unknown trumps known-low).
  const band = (w: string): number => lexicon.get(w) ?? Number.MAX_SAFE_INTEGER;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.isPunct) {
      out.push(t);
      i++;
      continue;
    }
    let merged = t;
    let j = i + 1;
    while (j < tokens.length && !tokens[j].isPunct) {
      const candidate = merged.w + tokens[j].w;
      const candidateBand = lexicon.get(candidate);
      if (candidateBand === undefined || candidate.length > MAX_WORD) break;
      const worstPart = Math.max(band(merged.w), band(tokens[j].w));
      if (candidateBand >= worstPart) break;
      merged = mergeSpan(merged, tokens[j]);
      j++;
    }
    out.push(merged);
    i = j;
  }

  // Pass 2 — split: (a) tokens outside the lexicon that fully decompose
  // into lexicon headwords (多少钱 → 多少|钱), and (b) lexicon tokens whose
  // greedy decomposition is entirely LOWER-band than the whole (个人 HSK5 →
  // 个|人 HSK1, 回家 HSK7 → 回|家) — dataset quirks where a common phrase
  // outranks its everyday reading. Order preserved; punct passes through.
  const split: StoryToken[] = [];
  for (const t of out) {
    if (t.isPunct) {
      split.push(t);
      continue;
    }
    const wholeBand = lexicon.get(t.w);
    const parts = longestSplit(t.w, lexicon, true);
    if (parts) {
      const partBands = parts.map((p) => lexicon.get(p));
      const allKnown = partBands.every((b) => b !== undefined);
      const better =
        allKnown && wholeBand !== undefined && Math.max(...(partBands as number[])) < wholeBand;
      if (wholeBand === undefined || (better && parts.length > 1)) {
        let s = t.s;
        for (const p of parts) {
          split.push({ ...t, w: p, s, e: s + p.length });
          s += p.length;
        }
        continue;
      }
    }
    split.push(t);
  }
  return split;
}

function mergeSpan(a: StoryToken, b: StoryToken): StoryToken {
  return { ...a, w: a.w + b.w, e: b.e };
}

/** Greedy longest-prefix lexicon decomposition, or null if incomplete.
 *  When excludeWhole=true, the first call never returns [w] — useful for
 *  split-where-better where the whole token is already in the lexicon but
 *  the decomposition is better (lower-band). */
function longestSplit(w: string, lexicon: HskLexicon, excludeWhole = false): string[] | null {
  const parts: string[] = [];
  let rest = w;
  let first = true;
  while (rest.length > 0) {
    const maxLen = Math.min(MAX_WORD, rest.length);
    const skipWhole = excludeWhole && first && rest.length === w.length;
    let matched: string | null = null;
    for (let len = maxLen; len >= 1; len--) {
      if (skipWhole && len === maxLen) continue;
      const head = rest.slice(0, len);
      if (lexicon.has(head)) {
        matched = head;
        break;
      }
    }
    if (!matched) return null;
    parts.push(matched);
    rest = rest.slice(matched.length);
    first = false;
  }
  return parts;
}

function sensesFor(lemma: string, cedict: CedictData | null): TokenSense[] | null {
  if (!cedict) return null;
  const entries = cedict[lemma];
  if (!entries || entries.length === 0) return null;
  return entries.map(([py, meanings]) => ({
    pinyin: py,
    meanings,
  }));
}

export interface SegmentOptions {
  lexicon: HskLexicon;
  cedict?: CedictData | null;
}

/**
 * Segment `text` into annotated tokens. `s`/`e` are char offsets into the
 * original string; `sentence` spans group tokens between sentence-final
 * punctuation (also returned as token-index ranges in the second result).
 */
export function segmentText(
  text: string,
  opts: SegmentOptions
): { tokens: StoryToken[]; sentences: SentenceSpan[] } {
  // Per-char context pinyin, aligned 1:1 with non-surrogate chars of `text`.
  // pinyin-pro splits by code point; zip via Array.from to handle the text
  // the same way (stories are BMP CJK + ASCII, no surrogates expected).
  const chars = Array.from(text);
  const perChar = pinyin(text, { type: "all" }) as {
    origin: string;
    pinyin: string;
    isZh: boolean;
  }[];

  // Build char-index → per-char pinyin map. `type: "all"` yields one item per
  // NON-ZH segment too (e.g. "，" or "a"); walk their origin lengths.
  const pyAt = new Array<string | null>(chars.length).fill(null);
  let ci = 0;
  for (const item of perChar) {
    const itemChars = Array.from(item.origin);
    for (let k = 0; k < itemChars.length && ci + k < chars.length; k++) {
      pyAt[ci + k] = item.pinyin || null;
    }
    ci += itemChars.length;
  }

  // Raw segmenter pass (surfaces + offsets only, split/merge fixable)
  interface RawToken {
    s: number;
    e: number;
    w: string;
    isPunct: boolean;
  }
  const raw: RawToken[] = [];
  for (const seg of SEGMENTER.segment(text)) {
    const surface = seg.segment;
    raw.push({
      s: seg.index,
      e: seg.index + surface.length,
      w: surface,
      isPunct: isPunctToken(surface, seg.isWordLike),
    });
  }

  // Re-align against the lexicon, then annotate (pinyin/level/senses).
  const aligned: RawToken[] = realignTokens(
    raw.map((t) => ({ ...t, py: null, lvl: null, senses: null, sentence: 0 })),
    opts.lexicon
  );

  const tokens: StoryToken[] = [];
  const sentences: SentenceSpan[] = [];
  let sentenceStart = 0;

  for (const t of aligned) {
    const punct = t.isPunct;

    let py: string | null = null;
    let lvl: number | null = null;
    let senses: TokenSense[] | null = null;

    if (!punct) {
      const parts: string[] = [];
      for (let i = t.s; i < t.e; i++) parts.push(pyAt[i] ?? "");
      py = parts.filter(Boolean).join(" ") || null;
      lvl = opts.lexicon.get(t.w) ?? null;
      senses = sensesFor(t.w, opts.cedict ?? null);
    }

    tokens.push({
      s: t.s,
      e: t.e,
      w: t.w,
      py,
      lvl,
      senses,
      isPunct: punct,
      sentence: sentences.length,
    });

    const surface = t.w;
    const endsSentence = SENTENCE_END.test(surface.slice(-1)) || surface.includes("\n");
    if (endsSentence && tokens.length > sentenceStart) {
      sentences.push({ t0: sentenceStart, t1: tokens.length });
      sentenceStart = tokens.length;
    }
  }

  // Trailing tokens without terminal punctuation still form a sentence.
  // Must run BEFORE the punctuation-merge pass below so a final
  // punctuation-only span (e.g. a lone closing quote after the last 。)
  // is eligible to merge into the previous sentence too.
  if (tokens.length > sentenceStart) {
    sentences.push({ t0: sentenceStart, t1: tokens.length });
  }

  // Post-processing: merge back punctuation-only sentence spans into the
  // previous sentence. This fixes orphaned closing quotes (`"`, `"` etc.)
  // that the segmenter places after sentence-ending punctuation.
  let i = 0;
  while (i < sentences.length) {
    const span = sentences[i];
    const tokensInSpan = tokens.slice(span.t0, span.t1);
    if (tokensInSpan.length > 0 && tokensInSpan.every((t) => t.isPunct)) {
      if (i > 0) {
        const prev = sentences[i - 1];
        prev.t1 = span.t1;
        sentences.splice(i, 1);
        // Don't increment i — re-check the new sentence at this index
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  // Re-index token.sentence to match the corrected sentence spans
  for (let si = 0; si < sentences.length; si++) {
    const span = sentences[si];
    for (let ti = span.t0; ti < span.t1; ti++) {
      tokens[ti].sentence = si;
    }
  }

  return { tokens, sentences };
}
