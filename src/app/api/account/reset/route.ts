import { NextResponse } from "next/server";

import { logApiError, parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { accountResetSchema } from "@/lib/validation";

/** Destructive: wipe all of the user's learning progress and review history. */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const parsed = await parseBody(req, accountResetSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Rate-limit destructive progress reset: 1 per user per day
  if (!rateLimit(`account-reset:${userId}`, 1, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Progress reset rate limited — try again tomorrow" },
      { status: 429 }
    );
  }

  try {
    await prisma.$transaction([
      prisma.reviewLog.deleteMany({ where: { userId } }),
      prisma.userProgress.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("/api/account/reset", error, userId);
    return NextResponse.json(
      { error: "Could not reset progress" },
      { status: 500 }
    );
  }
}
