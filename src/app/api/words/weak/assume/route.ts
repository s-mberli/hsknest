import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** Convert all current weak words to assumed-known, clearing their schedule. */
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.userProgress.updateMany({
    where: {
      userId,
      lapses: { gte: 3 },
      state: { notIn: ["MASTERED", "ASSUMED"] },
    },
    data: {
      state: "ASSUMED",
      dueAt: now,
      introducedAt: now,
      repetitions: 0,
      intervalDays: 0,
    },
  });

  return NextResponse.json({ updated: result.count });
}
