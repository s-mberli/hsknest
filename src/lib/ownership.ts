import type { Prisma } from "@prisma/client";

/**
 * A word list is visible to a user when it is public (seeded) or owned by them.
 * Centralized so every read path applies the same rule.
 */
export function visibleListWhere(userId: string): Prisma.WordListWhereInput {
  return { OR: [{ isPublic: true }, { createdById: userId }] };
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
