import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { feedbackSchema } from "@/lib/validation";

/**
 * File an in-app bug report, idea, word-quality flag, or cancellation feedback.
 * Auth required, rate-limited to 5 per day per user. Rows are displayed in the
 * read-only operator dashboard at /mb-admin (gated by ADMIN_EMAIL env var).
 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  if (!rateLimit(`feedback:${userId}`, 5, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "You've reached today's feedback limit — thanks for the reports!" },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, feedbackSchema);
  if (parsed instanceof NextResponse) return parsed;

  await prisma.feedback.create({
    data: {
      userId,
      category: parsed.category,
      message: parsed.message,
      page: parsed.page,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
