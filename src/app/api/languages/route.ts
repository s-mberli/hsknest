import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { visibleLanguageWhere } from "@/lib/ownership";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const [languages, user] = await Promise.all([
    prisma.language.findMany({
      where: visibleLanguageWhere(userId),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { targetLanguageId: true },
    }),
  ]);

  return NextResponse.json({
    languages,
    targetLanguageId: user?.targetLanguageId ?? null,
  });
}
