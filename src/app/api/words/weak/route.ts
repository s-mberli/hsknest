import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** Weak words: lapsed >= 3 times and not yet mastered or assumed-known. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.userProgress.findMany({
    where: {
      userId,
      lapses: { gte: 3 },
      state: { notIn: ["MASTERED", "ASSUMED"] },
    },
    orderBy: { lapses: "desc" },
    include: { word: true },
  });

  const words = rows.map((p) => ({
    wordId: p.wordId,
    term: p.word.term,
    phonetic: p.word.phonetic,
    translation: p.word.translation,
    state: p.state,
    lapses: p.lapses,
    intervalDays: p.intervalDays,
  }));

  return NextResponse.json({ words });
}
