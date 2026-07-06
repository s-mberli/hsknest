import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { visibleListWhere } from "@/lib/ownership";
import { enrollSchema } from "@/lib/validation";

/**
 * Mark words in a list as already-known (state ASSUMED). New enrollments are
 * inserted; existing NEW/LEARNING/LAPSED progress is flipped to ASSUMED. Words
 * already in REVIEW or MASTERED are left alone.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let payload: unknown = {};
  try {
    const text = await req.text();
    if (text) payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = enrollSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const list = await prisma.wordList.findFirst({
    where: { id, ...visibleListWhere(userId) },
    include: { words: { select: { id: true } } },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const listWordIds = new Set(list.words.map((w) => w.id));
  const requested = parsed.data.wordIds;
  const wordIds = requested
    ? requested.filter((wid) => listWordIds.has(wid))
    : [...listWordIds];

  if (wordIds.length === 0) {
    return NextResponse.json({ assumed: 0 });
  }

  const existing = await prisma.userProgress.findMany({
    where: { userId, wordId: { in: wordIds } },
    select: { wordId: true, state: true },
  });
  const existingByWord = new Map(existing.map((p) => [p.wordId, p.state]));

  const now = new Date();
  // Words with no progress yet — insert as ASSUMED (SQLite: no skipDuplicates).
  const toInsert = wordIds.filter((wid) => !existingByWord.has(wid));
  // Words already tracked but not yet "learned" — flip to ASSUMED.
  const toUpdate = existing
    .filter((p) => p.state !== "REVIEW" && p.state !== "MASTERED")
    .map((p) => p.wordId);

  const ops = [];
  if (toInsert.length > 0) {
    ops.push(
      prisma.userProgress.createMany({
        data: toInsert.map((wordId) => ({
          userId,
          wordId,
          state: "ASSUMED" as const,
          dueAt: now,
        })),
      })
    );
  }
  if (toUpdate.length > 0) {
    ops.push(
      prisma.userProgress.updateMany({
        where: { userId, wordId: { in: toUpdate } },
        data: { state: "ASSUMED", dueAt: now },
      })
    );
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  return NextResponse.json({ assumed: toInsert.length + toUpdate.length });
}
