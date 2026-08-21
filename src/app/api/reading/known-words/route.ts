import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { wordStrength } from "@/lib/strength";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`known-words:${userId}`, 300, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Words in the user's deck — include ALL states, map to strength bands
  const progress = await prisma.userProgress.findMany({
    where: { userId },
    select: {
      word: { select: { term: true } },
      state: true,
      intervalDays: true,
      lapses: true,
    },
  });

  const result = progress.map((r) => ({
    lemma: r.word.term,
    strength: wordStrength({ state: r.state, intervalDays: r.intervalDays, lapses: r.lapses }),
  }));

  return NextResponse.json({ known: result });
}
