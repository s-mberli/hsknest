import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { termKey } from "@/lib/progressMerge";
import { visibleListWhere } from "@/lib/ownership";
import { enrollSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  // Body is optional — omitting it enrolls the whole list.
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

  // Public lists are open to everyone; private lists only to their owner
  // (you can always study your own list).
  if (!list.isPublic && list.createdById !== userId) {
    return NextResponse.json({ error: "List not public" }, { status: 403 });
  }

  const wordById = new Map(list.words.map((w) => [w.id, w]));
  const requested = parsed.data.wordIds;
  const wordIds = requested
    ? requested.filter((wid) => wordById.has(wid))
    : [...wordById.keys()];

  if (wordIds.length === 0) {
    return NextResponse.json({ enrolled: 0, alreadyTracked: 0 });
  }

  // Shared progress by term: skip any term the user already tracks in this
  // language (same word in another list = same card, not a duplicate).
  const trackedSameLanguage = await prisma.userProgress.findMany({
    where: {
      userId,
      word: { wordList: { languageId: list.languageId } },
    },
    select: { word: { select: { term: true } } },
  });
  const trackedTerms = new Set(
    trackedSameLanguage.map((p) => termKey(p.word.term))
  );

  const toEnroll: string[] = [];
  const seenTerms = new Set<string>();
  for (const wid of wordIds) {
    const key = termKey(wordById.get(wid)!.term);
    if (trackedTerms.has(key) || seenTerms.has(key)) continue;
    seenTerms.add(key);
    toEnroll.push(wid);
  }
  const alreadyTracked = wordIds.length - toEnroll.length;

  if (toEnroll.length === 0) {
    return NextResponse.json({ enrolled: 0, alreadyTracked });
  }

  const now = new Date();
  const result = await prisma.userProgress.createMany({
    data: toEnroll.map((wordId) => ({
      userId,
      wordId,
      dueAt: now,
    })),
  });

  return NextResponse.json({ enrolled: result.count, alreadyTracked });
}

/**
 * Un-enroll: remove this list's words from the user's study queue by deleting
 * their progress rows. Only affects progress tied to this list's word IDs —
 * the same term enrolled via another list keeps its own progress.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const list = await prisma.wordList.findFirst({
    where: { id, ...visibleListWhere(userId) },
    select: { id: true },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const result = await prisma.userProgress.deleteMany({
    where: { userId, word: { wordListId: id } },
  });

  return NextResponse.json({ removed: result.count });
}
