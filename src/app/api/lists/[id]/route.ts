import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { visibleListWhere } from "@/lib/ownership";
import { updateListSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const list = await prisma.wordList.findFirst({
    where: { id, ...visibleListWhere(userId) },
    include: {
      language: { select: { code: true, name: true } },
      words: { orderBy: { position: "asc" } },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const progress = await prisma.userProgress.findMany({
    where: { userId, wordId: { in: list.words.map((w) => w.id) } },
    select: {
      wordId: true,
      state: true,
      intervalDays: true,
      lapses: true,
      dueAt: true,
    },
  });
  const progressByWord = new Map(progress.map((p) => [p.wordId, p]));

  return NextResponse.json({
    id: list.id,
    name: list.name,
    description: list.description,
    languageCode: list.language.code,
    languageName: list.language.name,
    isOwner: list.createdById === userId,
    words: list.words.map((w) => {
      const p = progressByWord.get(w.id);
      return {
        id: w.id,
        term: w.term,
        translation: w.translation,
        phonetic: w.phonetic,
        metadata: w.metadata,
        state: p?.state ?? null,
        intervalDays: p?.intervalDays ?? null,
        lapses: p?.lapses ?? null,
        dueAt: p?.dueAt ?? null,
      };
    }),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const parsed = await parseBody(req, updateListSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Owner-only: seeded/public lists (createdById null) are read-only.
  const list = await prisma.wordList.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!list || list.createdById !== userId) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const { name, description } = parsed;
  const updated = await prisma.wordList.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    },
    select: { id: true, name: true, description: true },
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

  const list = await prisma.wordList.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!list || list.createdById !== userId) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  // Words (and their UserProgress) cascade via schema onDelete: Cascade.
  await prisma.wordList.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
