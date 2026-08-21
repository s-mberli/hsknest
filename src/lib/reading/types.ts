/**
 * Reading Mode shared types. The hydrated document (`HydratedText`) is built
 * once at ingest and stored in `ReadingText.bodyHydrated`; the client renders
 * straight from it — no runtime segmentation, dictionary calls, or pinyin
 * work. Char offsets (`s`/`e`) index into `bodyRaw` and drive karaoke
 * highlight mapping against the audio timing sidecar.
 */

export interface TokenSense {
  /** dictionary pinyin for this sense (tone-marked) */
  pinyin: string;
  meanings: string[];
}

/** One word/punctuation token in a hydrated text. */
export interface StoryToken {
  /** start char offset into bodyRaw (inclusive) */
  s: number;
  /** end char offset (exclusive) */
  e: number;
  /** surface form */
  w: string;
  /** context-resolved pinyin, space-joined for multi-char words; null for punctuation */
  py: string | null;
  /** vocabulary level of the full lemma; null = outside the list */
  lvl: number | null;
  /** dictionary senses (CC-CEDICT); null = not found */
  senses: TokenSense[] | null;
  isPunct: boolean;
  /** sentence index */
  sentence: number;
}

/** Sentence spans for karaoke sentence-level highlighting. */
export interface SentenceSpan {
  /** token index range [start, end) within the token list */
  t0: number;
  t1: number;
  /** English translation of this sentence (optional) */
  en?: string;
}

export interface HydratedText {
  v: 1;
  /** char count of bodyRaw */
  chars: number;
  tokens: StoryToken[];
  sentences: SentenceSpan[];
  words: { total: number; unique: number };
}

/** Verification report from the grading pass (stored in gradeReport). */
export interface GradeReport {
  targetLevel: number;
  verdict: "pass" | "flag";
  /** share of word tokens above the target level (0..1) */
  aboveLevelPct: number;
  /** unique lemmas per vocabulary band (level -> count); null-band under "off" */
  bandHistogram: Record<string, number>;
  /** distinct lemmas above target level, with counts */
  aboveLevel: { lemma: string; lvl: number; count: number }[];
  /** distinct lemmas outside the vocabulary list entirely */
  offList: { lemma: string; count: number }[];
  /** at-target-band lemmas appearing fewer than 3 times (learning-load warning) */
  lowRepetition: { lemma: string; count: number }[];
  /** distinct lemmas whose level is exactly targetLevel (the "floor" count) */
  atLevelUnique: number;
  /** CJK character count of the story body */
  chars: number;
  /** why verdict is "flag"; empty when "pass" */
  reasons: string[];
  /** avg + max sentence length in characters (CJK only) */
  sentenceLength: { avg: number; max: number };
  estimatedMin: number;
  gradedAt: string;
}
