/**
 * Delete stale guest accounts: created more than 14 days ago with no review
 * in the last 14 days. Guests are throwaway by design (Settings says so), so
 * this only reclaims rows nobody can log back into anyway. Run at container
 * boot from docker-entrypoint.sh; safe to run any time.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

async function main() {
  const cutoff = new Date(Date.now() - STALE_MS);

  const staleGuests = await prisma.user.findMany({
    where: {
      email: { endsWith: "@guest.local" },
      createdAt: { lt: cutoff },
      reviewLogs: { none: { reviewedAt: { gte: cutoff } } },
    },
    select: { id: true },
  });

  if (staleGuests.length === 0) {
    console.log("→ No stale guest accounts.");
    return;
  }

  const ids = staleGuests.map((u) => u.id);
  await prisma.$transaction([
    // Guest-created lists/languages don't cascade from User (optional
    // relation), so remove them first to avoid orphaned rows.
    prisma.wordList.deleteMany({ where: { createdById: { in: ids } } }),
    prisma.language.deleteMany({ where: { createdById: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`→ Pruned ${ids.length} stale guest account(s).`);
}

main()
  .catch((err) => {
    // Pruning is housekeeping — never block the app from starting.
    console.error("Guest pruning failed:", err);
  })
  .finally(() => prisma.$disconnect());
