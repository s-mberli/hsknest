import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { readingEncounterSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`encounter:${userId}`, 300, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = readingEncounterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { lemma, languageId } = parsed.data;

  // Validate language exists
  const lang = await prisma.language.findUnique({ where: { id: languageId }, select: { id: true } });
  if (!lang) return NextResponse.json({ error: "Invalid language" }, { status: 400 });

  const encounter = await prisma.wordEncounter.upsert({
    where: { userId_languageId_lemma: { userId, languageId, lemma } },
    create: { userId, languageId, lemma, lookups: 1 },
    update: { lookups: { increment: 1 }, lastSeenAt: new Date() },
  });

  return NextResponse.json({
    lookups: encounter.lookups,
    added: encounter.addedWordId !== null,
    nudge: encounter.lookups >= 3 && encounter.addedWordId === null,
  });
}
