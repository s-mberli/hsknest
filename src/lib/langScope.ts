import type { Prisma } from "@prisma/client";

/**
 * Prisma `UserProgress` where-fragment that narrows to a single target language.
 * Shared by the dashboard stats (`getDashboardStats`) and the study queue so the
 * ring and the session count words the same way — otherwise the ring can promise
 * a card the session then refuses. Returns `{}` (no narrowing) when no target is
 * set.
 */
export function targetLangFilter(
  targetLanguageId: string | null | undefined
): Prisma.UserProgressWhereInput {
  return targetLanguageId
    ? { word: { wordList: { languageId: targetLanguageId } } }
    : {};
}
