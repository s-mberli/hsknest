/**
 * db-stats.ts — READ-ONLY database health readout.
 *
 * Usage:  npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/db-stats.ts
 *
 * Prints: user count, language/list/word counts, UserProgress rows grouped by
 * CardState, review-log count (+ last review time), feedback count by status.
 */
import { PrismaClient } from "@prisma/client";
import { fmtDate, printTable } from "./_shared";

const prisma = new PrismaClient();

async function main() {
  const [users, languages, wordLists, words, progressTotal, reviewLogs, feedback] =
    await Promise.all([
      prisma.user.count(),
      prisma.language.count(),
      prisma.wordList.count(),
      prisma.word.count(),
      prisma.userProgress.count(),
      prisma.reviewLog.count(),
      prisma.feedback.count(),
    ]);

  console.log(`Database: ${process.env.DATABASE_URL}\n`);
  printTable(
    ["entity", "count"],
    [
      ["users", users],
      ["languages", languages],
      ["wordLists", wordLists],
      ["words", words],
      ["userProgress", progressTotal],
      ["reviewLogs", reviewLogs],
      ["feedback", feedback],
    ]
  );

  if (progressTotal > 0) {
    const byState = await prisma.userProgress.groupBy({
      by: ["state"],
      _count: { _all: true },
    });
    console.log("\nUserProgress by state:");
    printTable(
      ["state", "count"],
      byState
        .sort((a, b) => b._count._all - a._count._all)
        .map((g) => [g.state, g._count._all])
    );
  }

  if (reviewLogs > 0) {
    const last = await prisma.reviewLog.findFirst({
      orderBy: { reviewedAt: "desc" },
      select: { reviewedAt: true, quality: true, algorithm: true },
    });
    console.log(
      `\nLast review: ${fmtDate(last?.reviewedAt)} (quality=${last?.quality}, ${last?.algorithm})`
    );
  }

  if (feedback > 0) {
    const byStatus = await prisma.feedback.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    console.log("\nFeedback by status:");
    printTable(
      ["status", "count"],
      byStatus.map((g) => [g.status, g._count._all])
    );
  }

  if (users === 0) {
    console.log(
      "\nEmpty database: no users yet. Seed with `npm run db:seed` or register via the UI."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
