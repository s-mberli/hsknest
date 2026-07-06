import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { updateWordSchema } from "@/lib/validation";

/** Confirm the word exists and its parent list is owned by the caller. */
async function ownedWord(wordId: string, userId: string) {
  return prisma.word.findFirst({
    where: { id: wordId, wordList: { createdById: userId } },
    select: { id: true },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateWordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const owned = await ownedWord(id, userId);
  if (!owned) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const { term, translation, phonetic } = parsed.data;
  const updated = await prisma.word.update({
    where: { id },
    data: {
      ...(term !== undefined ? { term } : {}),
      ...(translation !== undefined ? { translation } : {}),
      ...(phonetic !== undefined ? { phonetic } : {}),
    },
    select: { id: true, term: true, translation: true, phonetic: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const owned = await ownedWord(id, userId);
  if (!owned) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  // UserProgress rows cascade via schema onDelete: Cascade.
  await prisma.word.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
