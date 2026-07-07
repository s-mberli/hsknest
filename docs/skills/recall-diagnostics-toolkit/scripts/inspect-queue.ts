/**
 * inspect-queue.ts — READ-ONLY study-queue composition report for one user.
 *
 * Usage:  npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/inspect-queue.ts <email>
 *
 * MIRRORS the real queue logic in src/app/api/study/queue/route.ts:
 *   - due filter:   dueAt <= now, state IN (LEARNING, REVIEW, LAPSED)
 *   - new-cap:      count(introducedAt >= startOfLocalDay, state != ASSUMED) vs user.dailyNewWords
 *   - check-cap:    count(assumedCheckedAt >= startOfLocalDay) vs user.assumedCheckPerDay
 *   - startOfLocalDay mirrors src/lib/utils.ts (local midnight)
 * APPROXIMATES / DIFFERS from the route:
 *   - No scope filter (the route can narrow to a list/language via ?scope=; we report globally)
 *   - No `limit` truncation and no quiz-choice generation
 *   - Ordering of candidate NEW/ASSUMED shown by word.position, same as the route
 */
import { PrismaClient } from "@prisma/client";
import { fmtDate, printTable, startOfLocalDay } from "./_shared";

const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/inspect-queue.ts <email>"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      preferredAlgorithm: true,
      dailyNewWords: true,
      assumedCheckPerDay: true,
      intervalModifier: true,
      lapseModifier: true,
      masteryThresholdDays: true,
      fuzzIntervals: true,
    },
  });
  if (!user) {
    const n = await prisma.user.count();
    console.error(`No user with email "${email}". Users in DB: ${n}`);
    if (n > 0) {
      const users = await prisma.user.findMany({ select: { email: true } });
      console.error("Known emails: " + users.map((u) => u.email).join(", "));
    }
    process.exit(2);
  }

  const now = new Date();
  const dayStart = startOfLocalDay(now);

  console.log(`User: ${user.email}  (algorithm: ${user.preferredAlgorithm})`);
  console.log(
    `Settings: dailyNewWords=${user.dailyNewWords} assumedCheckPerDay=${user.assumedCheckPerDay} ` +
      `intervalModifier=${user.intervalModifier} lapseModifier=${user.lapseModifier} ` +
      `masteryThresholdDays=${user.masteryThresholdDays ?? "null"} fuzzIntervals=${user.fuzzIntervals}`
  );
  console.log(`Now: ${fmtDate(now)}  Local day start: ${fmtDate(dayStart)}\n`);

  // 1. Due reviews (mirrors route step 1, unscoped, no limit).
  const due = await prisma.userProgress.findMany({
    where: {
      userId: user.id,
      dueAt: { lte: now },
      state: { in: ["LEARNING", "REVIEW", "LAPSED"] },
    },
    orderBy: { dueAt: "asc" },
    include: { word: { select: { term: true, translation: true } } },
  });

  // 2. Daily-cap counters (mirrors route exactly, intentionally unscoped).
  const [newIntroducedToday, assumedCheckedToday] = await Promise.all([
    prisma.userProgress.count({
      where: {
        userId: user.id,
        introducedAt: { gte: dayStart },
        state: { notIn: ["ASSUMED"] },
      },
    }),
    prisma.userProgress.count({
      where: { userId: user.id, assumedCheckedAt: { gte: dayStart } },
    }),
  ]);
  const newAllowedToday = Math.max(0, user.dailyNewWords - newIntroducedToday);
  const checksAllowedToday = Math.max(
    0,
    user.assumedCheckPerDay - assumedCheckedToday
  );

  // Candidate pools (what the route would draw from next).
  const [newPool, assumedPool] = await Promise.all([
    prisma.userProgress.count({ where: { userId: user.id, state: "NEW" } }),
    prisma.userProgress.count({ where: { userId: user.id, state: "ASSUMED" } }),
  ]);

  console.log(`Due reviews now:        ${due.length}`);
  console.log(
    `New-word budget:        used ${newIntroducedToday} / ${user.dailyNewWords}, remaining ${newAllowedToday} (NEW pool: ${newPool})`
  );
  console.log(
    `Assumed-check budget:   used ${assumedCheckedToday} / ${user.assumedCheckPerDay}, remaining ${checksAllowedToday} (ASSUMED pool: ${assumedPool})\n`
  );

  if (due.length > 0) {
    console.log("Due cards (oldest first):");
    printTable(
      ["term", "state", "dueAt", "intervalDays", "EF", "box", "lapses"],
      due
        .slice(0, 25)
        .map((p) => [
          p.word.term,
          p.state,
          fmtDate(p.dueAt),
          p.intervalDays.toFixed(2),
          p.easeFactor.toFixed(2),
          p.box,
          p.lapses,
        ])
    );
    if (due.length > 25) console.log(`... and ${due.length - 25} more`);
    console.log();
  }

  // Next upcoming reviews (not yet due) — helps answer "when is my next session?"
  const upcoming = await prisma.userProgress.findMany({
    where: {
      userId: user.id,
      dueAt: { gt: now },
      state: { in: ["LEARNING", "REVIEW", "LAPSED"] },
    },
    orderBy: { dueAt: "asc" },
    take: 10,
    include: { word: { select: { term: true } } },
  });
  if (upcoming.length > 0) {
    console.log("Next 10 upcoming (not yet due):");
    printTable(
      ["term", "state", "dueAt", "intervalDays"],
      upcoming.map((p) => [
        p.word.term,
        p.state,
        fmtDate(p.dueAt),
        p.intervalDays.toFixed(2),
      ])
    );
  } else {
    console.log("No upcoming scheduled reviews.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
