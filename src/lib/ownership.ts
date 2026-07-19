import type { Prisma } from "@prisma/client";

/**
 * A word list is visible to a user when it is public (seeded) or owned by them.
 * Centralized so every read path applies the same rule.
 */
export function visibleListWhere(userId: string): Prisma.WordListWhereInput {
  return { OR: [{ isPublic: true }, { createdById: userId }] };
}

/**
 * A word is owned by the caller when its parent list was created by them.
 * Write routes (PATCH/DELETE) use this instead of inlining
 * `{ wordList: { createdById: userId } }` so the ownership rule stays
 * alongside the read-side `visibleListWhere` helper.
 */
export function ownedWordWhere(
  wordId: string,
  userId: string
): Prisma.WordWhereInput {
  return { id: wordId, wordList: { createdById: userId } };
}

/**
 * A language is visible to a user when it is seeded (createdById null) or owned
 * by them. Users only ever see global languages plus the ones they added.
 */
export function visibleLanguageWhere(
  userId: string
): Prisma.LanguageWhereInput {
  return { OR: [{ createdById: null }, { createdById: userId }] };
}
