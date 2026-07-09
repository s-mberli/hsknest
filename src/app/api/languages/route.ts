import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { visibleLanguageWhere } from "@/lib/ownership";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const languages = await prisma.language.findMany({
    where: visibleLanguageWhere(userId),
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ languages });
}
