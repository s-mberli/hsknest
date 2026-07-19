import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { weakProgressWhere } from "@/lib/strength";

/** Weak words: lapsed >= 3 times and not yet mastered or assumed-known. */
export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const rows = await prisma.userProgress.findMany({
    where: weakProgressWhere(userId),
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
