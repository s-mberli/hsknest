import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { ownedWordWhere } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { updateWordSchema } from "@/lib/validation";

/** Confirm the word exists and its parent list is owned by the caller. */
async function ownedWord(wordId: string, userId: string) {
  return prisma.word.findFirst({
    where: ownedWordWhere(wordId, userId),
    select: { id: true },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const parsed = await parseBody(req, updateWordSchema);
  if (parsed instanceof NextResponse) return parsed;

  const owned = await ownedWord(id, userId);
  if (!owned) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const { term, translation, phonetic } = parsed;
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
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const owned = await ownedWord(id, userId);
  if (!owned) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  // UserProgress rows cascade via schema onDelete: Cascade.
  await prisma.word.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
