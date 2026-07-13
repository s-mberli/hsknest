import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";

/**
 * One example sentence for a word the user is studying, for the Words-tab
 * hover card. Returns { sentence: null } when the word has no linked sentence
 * (partial library coverage) — never an error. Ownership: the word must be one
 * the caller has progress on, so this leaks nothing beyond their own words.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const link = await prisma.sentenceWord.findFirst({
    where: {
      wordId: id,
      word: { progress: { some: { userId } } },
    },
    select: {
      sentence: {
        select: { text: true, translation: true, phonetic: true, source: true },
      },
    },
  });

  return NextResponse.json({ sentence: link?.sentence ?? null });
}
