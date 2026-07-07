import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/**
 * Destructive: delete the account and everything it owns. Progress, review
 * logs, and feedback cascade from User; user-created lists and languages have
 * optional back-relations (createdById is null for seeded rows), so they must
 * be deleted explicitly or they'd be orphaned into seeded-looking rows.
 */
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    // Word rows cascade from their list; other users can't be enrolled in
    // these lists (private lists are only visible to their owner).
    prisma.wordList.deleteMany({ where: { createdById: userId } }),
    prisma.language.deleteMany({ where: { createdById: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
