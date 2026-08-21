import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
  name: z.string().trim().min(1).max(100).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

export const guestCheckoutSchema = signupSchema.extend({
  interval: z.enum(["monthly", "yearly"]),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1),
});

export const reviewSchema = z.object({
  wordId: z.string().min(1),
  quality: z
    .number()
    .int()
    .min(0)
    .max(5) as z.ZodType<0 | 1 | 2 | 3 | 4 | 5>,
  // Practice/refresh mode: log the review for streak/stats but do NOT advance
  // the SRS schedule (no interval/dueAt/cap change).
  practice: z.boolean().optional(),
  source: z
    .enum(["srs", "quiz", "match", "sentences", "ninja"])
    .optional(),
  latencyMs: z.number().int().positive().optional(),
});

export const enrollSchema = z.object({
  wordIds: z.array(z.string().min(1)).optional(),
});

export const settingsSchema = z.object({
  preferredAlgorithm: z.enum(["SM2", "LEITNER", "FSRS"]).optional(),
  name: z.string().trim().min(1).optional(),
  dailyNewWords: z.number().int().min(0).max(200).optional(),
  assumedCheckPerDay: z.number().int().min(0).max(50).optional(),
  intervalModifier: z.number().min(0.5).max(3).optional(),
  lapseModifier: z.number().min(0).max(1).optional(),
  masteryThresholdDays: z.number().int().min(1).max(3650).nullable().optional(),
  fuzzIntervals: z.boolean().optional(),
  desiredRetention: z.number().min(0.70).max(0.97).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  studyTheme: z.enum(["dark", "follow"]).optional(),
  cardTextSize: z.enum(["small", "normal", "large"]).optional(),
  characterStyle: z.enum(["modern", "academic"]).optional(),
  showReading: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  autoPlayPronunciation: z.boolean().optional(),
  targetLanguageId: z.string().min(1).nullable().optional(),
});

export const accountResetSchema = z.object({
  scope: z.literal("progress"),
});

export const feedbackSchema = z.object({
  // "word" = a card-quality report filed from study mode (WordFeedback.tsx);
  // the rest come from Settings → Feedback.
  category: z.enum(["bug", "idea", "other", "cancellation", "word"]),
  message: z.string().trim().min(10).max(2000),
  page: z.string().trim().max(200).optional(),
});

// ── List & word CRUD ──────────────────────────────────────────────────────

const newLanguageSchema = z.object({
  name: z.string().trim().min(1).max(60),
  code: z.string().trim().min(2).max(10),
});

export const createListSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    languageId: z.string().min(1).optional(),
    newLanguage: newLanguageSchema.optional(),
  })
  .refine((v) => Boolean(v.languageId) !== Boolean(v.newLanguage), {
    message: "Provide either an existing languageId or a newLanguage, not both.",
    path: ["languageId"],
  });

export const updateListSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "Nothing to update.",
  });

export const wordInputSchema = z.object({
  term: z.string().trim().min(1).max(200),
  translation: z.string().trim().min(1).max(500),
  phonetic: z.string().trim().max(200).optional(),
});

export const bulkWordsSchema = z.object({
  words: z.array(wordInputSchema).min(1).max(2000),
});

export const updateWordSchema = z.object({
  term: z.string().trim().min(1).max(200).optional(),
  translation: z.string().trim().min(1).max(500).optional(),
  phonetic: z.string().trim().max(200).nullable().optional(),
});

/**
 * Shared cap constants for word/import limits. Kept alongside the Zod
 * schemas so the route and the UI both read from the same definition.
 */
export const WORD_LIMITS = {
  term: 200,
  translation: 500,
  phonetic: 200,
  /** Max rows a single import request may add. */
  importRows: 2000,
  /** Max alternative-meaning entries per word. */
  meanings: 20,
} as const;

export const dictionaryQuerySchema = z.object({
  term: z.string().trim().min(1).max(50),
  languageCode: z.string().trim().min(2).max(10),
});

export const importSchema = z
  .object({
    // ~100KB cap: guards the parser before the route's 2000-row post-parse limit.
    text: z.string().min(1).max(100_000),
    delimiter: z.enum(["auto", "tab", "comma"]).optional(),
    columns: z
      .array(z.enum(["term", "translation", "phonetic", "meanings", "ignore"]))
      .optional(),
  })
  .refine(
    (v) => {
      // Reject if the text starts with the ZIP local-file magic number
      // (PK\x03\x04 = bytes 50 4B 03 04), which indicates a binary .apkg file
      // or other ZIP archive that was mistakenly submitted as plain text.
      const text = v.text;
      if (text.length >= 4) {
        const first4 = text.substring(0, 4);
        if (
          first4.charCodeAt(0) === 0x50 &&
          first4.charCodeAt(1) === 0x4b &&
          first4.charCodeAt(2) === 0x03 &&
          first4.charCodeAt(3) === 0x04
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "This looks like a binary .apkg file. Export as plain text from Anki first.",
      path: ["text"],
    }
  );

export const listPrioritySchema = z.object({
  order: z.array(z.string().cuid()).min(1).max(100),
});

export const checkoutIntervalSchema = z.object({
  interval: z.enum(["monthly", "yearly"]).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type EnrollInput = z.infer<typeof enrollSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type AccountResetInput = z.infer<typeof accountResetSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type WordInput = z.infer<typeof wordInputSchema>;
export type BulkWordsInput = z.infer<typeof bulkWordsSchema>;
export type UpdateWordInput = z.infer<typeof updateWordSchema>;
export type ImportInput = z.infer<typeof importSchema>;
export type ListPriorityInput = z.infer<typeof listPrioritySchema>;
export type CheckoutIntervalInput = z.infer<typeof checkoutIntervalSchema>;

// ── Reading mode ────────────────────────────────────────────────────────────

export const readingEncounterSchema = z.object({
  lemma: z.string().min(1).max(50),
  languageId: z.string().min(1),
});

export const readingDeckSchema = z.object({
  lemma: z.string().min(1).max(50),
  languageId: z.string().min(1),
  pinyin: z.string().optional(),
  level: z.number().int().optional(),
  sentence: z.string().max(500).optional(),
  storySlug: z.string().max(100).optional(),
});

export const readingProgressSchema = z.object({
  textId: z.string().min(1),
  position: z.number().int().min(0).max(100),
  completed: z.boolean().optional(),
});

// Cap at 3 hours — a stale/backgrounded tab reporting elapsed wall-clock
// time (not active reading time) should not be able to post an absurd
// session length. See src/lib/readingActivity.ts for the noise floor on
// the other end (sessions too short to count as activity).
const MAX_READING_SESSION_MS = 3 * 60 * 60 * 1000;

export const readingSessionSchema = z.object({
  textId: z.string().min(1),
  durationMs: z.number().int().min(0).max(MAX_READING_SESSION_MS),
  completed: z.boolean().optional(),
});

// Post-read batch add ("you looked up N words — add them all?"). Capped at
// 50 — a generous ceiling for one story's worth of lookups, well above what
// a real reading session produces, while bounding transaction size.
export const readingDeckBatchSchema = z.object({
  languageId: z.string().min(1),
  storySlug: z.string().max(100).optional(),
  items: z
    .array(
      z.object({
        lemma: z.string().min(1).max(50),
        pinyin: z.string().optional(),
        level: z.number().int().optional(),
        sentence: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(50),
});

export type ReadingEncounterInput = z.infer<typeof readingEncounterSchema>;
export type ReadingDeckInput = z.infer<typeof readingDeckSchema>;
export type ReadingDeckBatchInput = z.infer<typeof readingDeckBatchSchema>;
export type ReadingProgressInput = z.infer<typeof readingProgressSchema>;
