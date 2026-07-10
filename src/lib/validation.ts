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
  reviewedAt: z.coerce.date().optional(),
  // Practice/refresh mode: log the review for streak/stats but do NOT advance
  // the SRS schedule (no interval/dueAt/cap change).
  practice: z.boolean().optional(),
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
  showReading: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  targetLanguageId: z.string().nullable().optional(),
});

export const accountResetSchema = z.object({
  scope: z.literal("progress"),
});

export const feedbackSchema = z.object({
  category: z.enum(["bug", "idea", "other"]),
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

export const dictionaryQuerySchema = z.object({
  term: z.string().trim().min(1).max(50),
  languageCode: z.string().trim().min(2).max(10),
});

export const importSchema = z.object({
  // ~100KB cap: guards the parser before the route's 2000-row post-parse limit.
  text: z.string().min(1).max(100_000),
  delimiter: z.enum(["auto", "tab", "comma"]).optional(),
  columns: z.array(z.enum(["term", "translation", "phonetic", "ignore"])).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
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
