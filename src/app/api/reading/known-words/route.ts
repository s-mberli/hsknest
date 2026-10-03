import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { wordStrength } from "@/lib/strength";
import { TRACKED_STATES } from "@/lib/cardStates";
import type { CardState } from "@/lib/srs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`known-words:${userId}`, 300, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Include every deck entry for add-to-deck deduplication; only tracked
  // states qualify for adaptive hints.
  const progress = await prisma.userProgress.findMany({
    where: { userId },
    select: {
      word: { select: { term: true } },
      state: true,
      intervalDays: true,
      lapses: true,
    },
  });

  const byLemma = new Map<string, { lemma: string; strength: string; learned: boolean }>();
  for (const row of progress) {
    const learned = TRACKED_STATES.has(row.state as CardState);
    const previous = byLemma.get(row.word.term);
    if (previous?.learned && !learned) continue;
    byLemma.set(row.word.term, {
      lemma: row.word.term,
      strength: wordStrength({ state: row.state, intervalDays: row.intervalDays, lapses: row.lapses }),
      learned,
    });
  }

  return NextResponse.json({ known: [...byLemma.values()] });
}
