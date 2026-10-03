import { z } from "zod";

const card = z.object({
  wordId: z.string().min(1),
  term: z.string(),
  translation: z.string(),
  phonetic: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  state: z.string(),
  kind: z.string().optional(),
  languageCode: z.string().optional(),
  lapses: z.number().nonnegative().optional(),
  preview: z.boolean().optional(),
  choices: z.array(z.string()).optional(),
  sentence: z.object({
    text: z.string(), translation: z.string(),
    phonetic: z.string().nullable().default(null), source: z.string().nullable(),
  }).optional(),
}).passthrough();

export const queueResponseSchema = z.object({
  retryOmitted: z.number().int().nonnegative().default(0),
  cards: z.array(card),
  counts: z.object({
    due: z.number().nonnegative(),
    newAllowedToday: z.number().nonnegative(),
    checksAllowedToday: z.number().nonnegative(),
  }),
});
