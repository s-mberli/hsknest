import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { termKey } from "@/lib/progressMerge";
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
    include: { words: { select: { id: true, term: true } } },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const wordById = new Map(list.words.map((w) => [w.id, w]));
  const requested = parsed.data.wordIds;
  const wordIds = requested
    ? requested.filter((wid) => wordById.has(wid))
    : [...wordById.keys()];

  if (wordIds.length === 0) {
    return NextResponse.json({ assumed: 0 });
  }

  // Shared progress by term: a twin word in another same-language list counts
  // as the same card, so "I know these" flips that row instead of inserting.
  const trackedSameLanguage = await prisma.userProgress.findMany({
    where: { userId, word: { wordList: { languageId: list.languageId } } },
    select: { wordId: true, state: true, word: { select: { term: true } } },
  });
  const trackedByTerm = new Map(
    trackedSameLanguage.map((p) => [termKey(p.word.term), p])
  );

  const now = new Date();
  const toInsert: string[] = [];
  const toUpdate: string[] = [];
  const seenTerms = new Set<string>();
  for (const wid of wordIds) {
    const key = termKey(wordById.get(wid)!.term);
    if (seenTerms.has(key)) continue;
    seenTerms.add(key);
    const tracked = trackedByTerm.get(key);
    if (!tracked) {
      // No progress yet — insert as ASSUMED (SQLite: no skipDuplicates).
      toInsert.push(wid);
    } else if (tracked.state !== "REVIEW" && tracked.state !== "MASTERED") {
      // Tracked but not yet "learned" — flip the existing row to ASSUMED.
      toUpdate.push(tracked.wordId);
    }
  }

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
