import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** Reset all current weak words back to a fresh NEW state (zeroed fields). */
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
      state: "NEW",
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      box: 1,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: null,
      introducedAt: null,
    },
  });

  return NextResponse.json({ updated: result.count });
}
