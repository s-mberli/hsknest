import type { Prisma, PrismaClient } from "@prisma/client";

import { GUEST_EMAIL_SUFFIX } from "./guest";

/**
 * A guest is stale when it was created before `cutoff` and has had no
 * activity since: no review AND no Reading Mode visit. A guest who only
 * reads writes ReadingSession rows and never a ReviewLog, so checking
 * reviews alone would delete an active reader.
 *
 * Relative import above: scripts/prune-guests.ts runs this via `tsx`
 * outside the Next.js app, where the "@/" alias does not resolve.
 */
export function staleGuestWhere(cutoff: Date): Prisma.UserWhereInput {
  return {
    email: { endsWith: GUEST_EMAIL_SUFFIX },
    createdAt: { lt: cutoff },
    reviewLogs: { none: { reviewedAt: { gte: cutoff } } },
    readingSessions: { none: { startedAt: { gte: cutoff } } },
  };
}

/** Delete stale guests and the lists/languages they created. → count. */
export async function pruneStaleGuests(prisma: PrismaClient, cutoff: Date): Promise<number> {
  const staleGuests = await prisma.user.findMany({
    where: staleGuestWhere(cutoff),
    select: { id: true },
  });
  if (staleGuests.length === 0) return 0;

  const ids = staleGuests.map((u) => u.id);
  await prisma.$transaction([
    // Guest-created lists/languages don't cascade from User (optional
    // relation), so remove them first to avoid orphaned rows.
    prisma.wordList.deleteMany({ where: { createdById: { in: ids } } }),
    prisma.language.deleteMany({ where: { createdById: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return ids.length;
}
