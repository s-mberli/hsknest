import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { bulkWordsSchema, wordInputSchema } from "@/lib/validation";
import type { WordInput } from "@/lib/validation";

/**
 * Add one or many words to an owned list. Accepts either a single word object
 * or `{ words: [...] }`. New words append after the current max position.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Support both the single-word and bulk shapes.
  let words: WordInput[];
  const bulk = bulkWordsSchema.safeParse(body);
  if (bulk.success) {
    words = bulk.data.words;
  } else {
    const single = wordInputSchema.safeParse(body);
    if (!single.success) {
      return NextResponse.json(
        { error: "Invalid input", details: single.error.flatten() },
        { status: 400 }
      );
    }
    words = [single.data];
  }

  // Owner-only: seeded lists are read-only.
  const list = await prisma.wordList.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!list || list.createdById !== userId) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const last = await prisma.word.findFirst({
    where: { wordListId: id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const basePosition = (last?.position ?? -1) + 1;

  const result = await prisma.word.createMany({
    data: words.map((w, i) => ({
      wordListId: id,
      term: w.term,
      translation: w.translation,
      phonetic: w.phonetic ?? null,
      position: basePosition + i,
    })),
  });

  return NextResponse.json({ added: result.count }, { status: 201 });
}
