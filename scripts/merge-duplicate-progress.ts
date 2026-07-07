/**
 * One-time-safe (idempotent) merge of duplicate progress rows created before
 * shared-progress-by-term: for each user, group progress by normalized term +
 * language, keep the strongest row (longest interval, then most repetitions,
 * then latest review), delete the rest. Run at container boot; a no-op once
 * duplicates are gone because enroll/assume now skip tracked terms.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function termKey(term: string): string {
  return term.trim().normalize("NFC");
}

interface Row {
  id: string;
  userId: string;
  intervalDays: number;
  repetitions: number;
  lastReviewedAt: Date | null;
  word: { term: string; wordList: { languageId: string } };
}

function strongest(rows: Row[]): Row {
  return rows.reduce((best, row) => {
    if (row.intervalDays !== best.intervalDays) {
      return row.intervalDays > best.intervalDays ? row : best;
    }
    if (row.repetitions !== best.repetitions) {
      return row.repetitions > best.repetitions ? row : best;
    }
    const a = row.lastReviewedAt?.getTime() ?? 0;
    const b = best.lastReviewedAt?.getTime() ?? 0;
    return a > b ? row : best;
  });
}

async function main() {
  const rows: Row[] = await prisma.userProgress.findMany({
    select: {
      id: true,
      userId: true,
      intervalDays: true,
      repetitions: true,
      lastReviewedAt: true,
      word: { select: { term: true, wordList: { select: { languageId: true } } } },
    },
  });

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.userId}|${row.word.wordList.languageId}|${termKey(row.word.term)}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const toDelete: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = strongest(group);
    for (const row of group) if (row.id !== keep.id) toDelete.push(row.id);
  }

  if (toDelete.length === 0) {
    console.log("→ No duplicate progress rows.");
    return;
  }

  await prisma.userProgress.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`→ Merged ${toDelete.length} duplicate progress row(s).`);
}

main()
  .catch((err) => {
    // Housekeeping — never block the app from starting.
    console.error("Duplicate-progress merge failed:", err);
  })
  .finally(() => prisma.$disconnect());
