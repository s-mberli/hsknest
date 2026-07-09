import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { visibleListWhere } from "@/lib/ownership";
import { createListSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(req.url);
  const languageId = url.searchParams.get("languageId") ?? undefined;

  const lists = await prisma.wordList.findMany({
    where: {
      ...visibleListWhere(userId),
      ...(languageId ? { languageId } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      language: { select: { code: true, name: true } },
      _count: { select: { words: true } },
    },
  });

  // How many words in each list the current user is already enrolled in.
  // Fetch only the user's own progress rows (bounded by their study set),
  // not every word in every visible list — that scan grows with the whole
  // content library and dominates dashboard load once HSK1–6 is seeded.
  const progressRows = await prisma.userProgress.findMany({
    where: { userId, word: { wordListId: { in: lists.map((l) => l.id) } } },
    select: { word: { select: { wordListId: true } } },
  });
  const enrolledCountByList = new Map<string, number>();
  for (const p of progressRows) {
    const listId = p.word.wordListId;
    enrolledCountByList.set(listId, (enrolledCountByList.get(listId) ?? 0) + 1);
  }

  return NextResponse.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      languageCode: l.language.code,
      languageName: l.language.name,
      wordCount: l._count.words,
      enrolledCount: enrolledCountByList.get(l.id) ?? 0,
      isOwner: l.createdById === userId,
    })),
  });
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const parsed = await parseBody(req, createListSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { name, description, languageId, newLanguage } = parsed;

  // Resolve the target language: either an existing (visible) one, or a new
  // user-owned language. Existing seeded/global languages can be reused.
  let resolvedLanguageId: string;
  if (newLanguage) {
    const code = newLanguage.code.toLowerCase();
    const existing = await prisma.language.findUnique({ where: { code } });
    if (existing) {
      // A language with this code already exists — reuse it rather than error.
      resolvedLanguageId = existing.id;
    } else {
      const created = await prisma.language.create({
        data: { name: newLanguage.name, code, createdById: userId },
        select: { id: true },
      });
      resolvedLanguageId = created.id;
    }
  } else {
    const language = await prisma.language.findFirst({
      where: {
        id: languageId,
        OR: [{ createdById: null }, { createdById: userId }],
      },
      select: { id: true },
    });
    if (!language) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }
    resolvedLanguageId = language.id;
  }

  const list = await prisma.wordList.create({
    data: {
      name,
      description: description ?? null,
      languageId: resolvedLanguageId,
      isPublic: false,
      createdById: userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: list.id }, { status: 201 });
}
