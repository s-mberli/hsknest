import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { weakProgressWhere } from "@/lib/strength";

/** Reset all current weak words back to a fresh NEW state (zeroed fields). */
export async function POST() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const now = new Date();
  const result = await prisma.userProgress.updateMany({
    where: weakProgressWhere(userId),
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
