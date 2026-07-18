import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { visibleListWhere } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { listPrioritySchema } from "@/lib/validation";

/**
 * Replace the caller's "Studying" list priority order wholesale. `order` is
 * an array of WordList ids; array index becomes `rank` (0 = highest
 * priority). Every id must be visible to the user (public or owned) — a
 * mismatch is rejected rather than silently dropped, so the client's order
 * never gets silently reinterpreted.
 */
export async function PATCH(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const body = await parseBody(req, listPrioritySchema);
  if (body instanceof NextResponse) return body;
  const { order } = body;

  const uniqueIds = Array.from(new Set(order));
  const visible = await prisma.wordList.count({
    where: { id: { in: uniqueIds }, ...visibleListWhere(userId) },
  });
  if (visible !== uniqueIds.length) {
    return NextResponse.json(
      { error: "One or more lists are not visible to you" },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.listPriority.deleteMany({ where: { userId } }),
    prisma.listPriority.createMany({
      data: uniqueIds.map((wordListId, rank) => ({ userId, wordListId, rank })),
    }),
  ]);

  return NextResponse.json({ order: uniqueIds });
}
