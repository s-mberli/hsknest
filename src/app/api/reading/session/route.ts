import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { readingSessionSchema } from "@/lib/validation";

// One call per reader visit (mount -> unmount/pagehide), so a generous cap
// here is just abuse protection, not a normal-use constraint.
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`reading-session:${userId}`, 120, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = readingSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { textId, durationMs, completed } = parsed.data;

  const story = await prisma.readingText.findUnique({ where: { id: textId }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - durationMs);

  await prisma.readingSession.create({
    data: { userId, textId, startedAt, endedAt, durationMs, completed: completed ?? false },
  });

  return NextResponse.json({ ok: true });
}
