import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { accountResetSchema } from "@/lib/validation";

/** Destructive: wipe all of the user's learning progress and review history. */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const parsed = await parseBody(req, accountResetSchema);
  if (parsed instanceof NextResponse) return parsed;

  await prisma.$transaction([
    prisma.reviewLog.deleteMany({ where: { userId } }),
    prisma.userProgress.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
