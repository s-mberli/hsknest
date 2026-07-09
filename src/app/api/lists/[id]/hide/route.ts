import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { visibleListWhere } from "@/lib/ownership";

/** Per-user hide/unhide of a visible list (e.g. an unwanted starter list). */
export async function POST(
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

  await prisma.hiddenList.upsert({
    where: { userId_listId: { userId, listId: id } },
    create: { userId, listId: id },
    update: {},
  });
  return NextResponse.json({ hidden: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;

  await prisma.hiddenList.deleteMany({ where: { userId, listId: id } });
  return NextResponse.json({ hidden: false });
}
