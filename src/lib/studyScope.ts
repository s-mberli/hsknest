import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { visibleLanguageWhere, visibleListWhere } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

export const CARDS_PER_MINUTE = 5; // ~12s/card
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 20;

/** A narrowing of a study session to a language and/or specific lists. */
export interface StudyScope {
  languageId?: string;
  listIds?: string[];
}

/**
 * Lenient coercion of the queue query string. Every field is optional and bad
 * values degrade to undefined rather than erroring — matches the app's forgiving
 * URL parsing (a stale/junk param should never 400 the study queue).
 */
export const queueQuerySchema = z.object({
  minutes: z.coerce.number().optional().catch(undefined),
  limit: z.coerce.number().optional().catch(undefined),
  languageId: z.string().optional().catch(undefined),
  listIds: z.string().optional().catch(undefined),
});

/** Split a comma-separated list of ids: trim, drop empties, dedupe. */
function parseListIds(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  );
  return ids.length > 0 ? ids : undefined;
}

/**
 * Resolve a session limit + scope from the URL params.
 * `minutes` wins over `limit` (×5 conversion); both are capped at MAX_LIMIT and
 * default to DEFAULT_LIMIT. Invalid values fall back to the default.
 */
export function parseQueueQuery(params: URLSearchParams): {
  limit: number;
  scope: StudyScope;
} {
  const parsed = queueQuerySchema.safeParse({
    minutes: params.get("minutes") ?? undefined,
    limit: params.get("limit") ?? undefined,
    languageId: params.get("languageId") ?? undefined,
    listIds: params.get("listIds") ?? undefined,
  });
  const data = parsed.success ? parsed.data : {};

  let limit = DEFAULT_LIMIT;
  if (
    data.minutes !== undefined &&
    Number.isFinite(data.minutes) &&
    data.minutes > 0
  ) {
    limit = Math.min(Math.floor(data.minutes) * CARDS_PER_MINUTE, MAX_LIMIT);
  } else if (
    data.limit !== undefined &&
    Number.isFinite(data.limit) &&
    data.limit > 0
  ) {
    limit = Math.min(Math.floor(data.limit), MAX_LIMIT);
  }

  const languageId =
    data.languageId && data.languageId.trim().length > 0
      ? data.languageId.trim()
      : undefined;
  const listIds = parseListIds(data.listIds);

  const scope: StudyScope = {};
  if (languageId) scope.languageId = languageId;
  if (listIds) scope.listIds = listIds;

  return { limit, scope };
}

/**
 * Build the UserProgress `where` fragment that narrows a session to the scope.
 * Empty scope → `{}` (no narrowing).
 *
 * Security: this only ever narrows the caller's OWN UserProgress rows (the queue
 * always ANDs in `userId`). Arbitrary listIds/languageId can't leak other users'
 * data — the worst case is an empty queue.
 *
 * With userId, also validates that scope parameters are within the user's visible lists/languages.
 * Without userId, returns the scope as-is (used in tests); with userId, validates against visibility.
 */
export function scopeToWordWhere(
  scope: StudyScope,
  userId?: string
): Prisma.UserProgressWhereInput | Promise<Prisma.UserProgressWhereInput> {
  const wordListWhere: Prisma.WordListWhereInput = {};

  if (scope.listIds && scope.listIds.length > 0) {
    wordListWhere.id = { in: scope.listIds };
  }

  if (scope.languageId) {
    wordListWhere.languageId = scope.languageId;
  }

  // If no userId, skip visibility validation (used in tests)
  if (!userId) {
    if (Object.keys(wordListWhere).length === 0) return {};
    return { word: { wordList: wordListWhere } };
  }

  // With userId: validate languageId and listIds are visible to the user
  return validateAndBuildWhere(scope, wordListWhere, userId);
}

/**
 * Async validation of scope parameters against user's visible lists/languages.
 */
async function validateAndBuildWhere(
  scope: StudyScope,
  wordListWhere: Prisma.WordListWhereInput,
  userId: string
): Promise<Prisma.UserProgressWhereInput> {
  // Validate languageId is visible to the user if specified
  if (scope.languageId) {
    const langExists = await prisma.language.findFirst({
      where: { id: scope.languageId, ...visibleLanguageWhere(userId) },
    });
    if (!langExists) {
      return {};
    }
  }

  // Validate all listIds are visible to the user
  if (scope.listIds && scope.listIds.length > 0) {
    const validLists = await prisma.wordList.findMany({
      where: { id: { in: scope.listIds }, ...visibleListWhere(userId) },
      select: { id: true },
    });
    const validIds = new Set(validLists.map((l) => l.id));
    const allValid = scope.listIds.every((id) => validIds.has(id));
    if (!allValid) {
      return {};
    }
  }

  wordListWhere.hiddenBy = {
    none: {
      userId: userId,
    },
  };

  if (Object.keys(wordListWhere).length === 0) return {};
  return { word: { wordList: wordListWhere } };
}
