import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { visibleListWhere } from "@/lib/ownership";
import { updateListSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const parsed = updateListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Owner-only: seeded/public lists (createdById null) are read-only.
  const list = await prisma.wordList.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!list || list.createdById !== userId) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const { name, description } = parsed.data;
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
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
