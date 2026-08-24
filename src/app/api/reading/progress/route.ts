import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { readingProgressSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`progress:${userId}`, 600, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = readingProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { textId, position, completed } = parsed.data;

  // Validate story exists
  const story = await prisma.readingText.findUnique({ where: { id: textId }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  await prisma.readingProgress.upsert({
    where: { userId_textId: { userId, textId } },
    create: {
      userId,
      textId,
      lastPosition: position,
      completedAt: completed ? new Date() : null,
    },
    update: {
      lastPosition: position,
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
