import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/session";
import { feedbackSchema } from "@/lib/validation";

/**
 * File an in-app bug report / idea. Auth required, rate-limited to 5 per day
 * per user. Rows are read via Prisma Studio for now (admin view → roadmap).
 */
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`feedback:${userId}`, 5, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "You've reached today's feedback limit — thanks for the reports!" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await prisma.feedback.create({
    data: {
      userId,
      category: parsed.data.category,
      message: parsed.data.message,
      page: parsed.data.page,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
