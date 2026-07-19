import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { weakProgressWhere } from "@/lib/strength";

/** Convert all current weak words to assumed-known, clearing their schedule. */
export async function POST() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const now = new Date();
  const result = await prisma.userProgress.updateMany({
    where: weakProgressWhere(userId),
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
