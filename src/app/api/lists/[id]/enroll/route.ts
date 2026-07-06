import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { visibleListWhere } from "@/lib/ownership";
import { enrollSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ enrolled: 0 });
  }

  // SQLite's createMany doesn't support skipDuplicates, so filter out any
  // words the user is already enrolled in before inserting.
  const alreadyEnrolled = await prisma.userProgress.findMany({
    where: { userId, wordId: { in: wordIds } },
    select: { wordId: true },
  });
  const enrolledSet = new Set(alreadyEnrolled.map((p) => p.wordId));
  const toEnroll = wordIds.filter((wid) => !enrolledSet.has(wid));

  if (toEnroll.length === 0) {
    return NextResponse.json({ enrolled: 0 });
  }

  const now = new Date();
  const result = await prisma.userProgress.createMany({
    data: toEnroll.map((wordId) => ({
      userId,
      wordId,
      dueAt: now,
    })),
  });

  return NextResponse.json({ enrolled: result.count });
}
