import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** All words the user is enrolled in, with progress fields for strength bands. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.userProgress.findMany({
    where: { userId },
    orderBy: { word: { position: "asc" } },
    include: {
      word: {
        include: {
          wordList: {
            select: { language: { select: { code: true, name: true } } },
          },
        },
      },
    },
  });

  const words = rows.map((p) => ({
    wordId: p.wordId,
    term: p.word.term,
    phonetic: p.word.phonetic,
    translation: p.word.translation,
    languageCode: p.word.wordList.language.code,
    languageName: p.word.wordList.language.name,
    state: p.state,
    intervalDays: p.intervalDays,
    lapses: p.lapses,
    dueAt: p.dueAt,
  }));

  return NextResponse.json({ words });
}
