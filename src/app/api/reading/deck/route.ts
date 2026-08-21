import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { readingDeckSchema } from "@/lib/validation";
import { termKey } from "@/lib/progressMerge";
import { ensureReadingList, resolveWordData } from "@/lib/reading/deckAdd";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`deck:${userId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = readingDeckSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { lemma, languageId, pinyin, level, sentence, storySlug } = parsed.data;

  // Validate language exists
  const lang = await prisma.language.findUnique({ where: { id: languageId }, select: { id: true } });
  if (!lang) return NextResponse.json({ error: "Invalid language" }, { status: 400 });

  // Shared progress by term: skip if the user already tracks this word in
  // this language from ANY list (own or seeded) — same word, same card, not
  // a duplicate. Mirrors the dedupe rule in /api/lists/[id]/enroll.
  const lemmaKey = termKey(lemma);
  const trackedSameLanguage = await prisma.userProgress.findMany({
    where: { userId, word: { wordList: { languageId } } },
    select: { word: { select: { term: true } } },
  });
  const alreadyTracked = trackedSameLanguage.some(
    (p) => termKey(p.word.term) === lemmaKey
  );
  if (alreadyTracked) return NextResponse.json({ ok: true, message: "Already in deck" });

  // Atomic: find-or-create list + create word + create progress + mark encounter
  await prisma.$transaction(async (tx) => {
    const list = await ensureReadingList(tx, userId, languageId);
    const data = resolveWordData({ lemma, pinyin, level, sentence }, storySlug, list.wordCount);

    const word = await tx.word.create({
      data: { ...data, wordListId: list.id },
    });

    await tx.userProgress.create({
      data: { userId, wordId: word.id },
    });

    await tx.wordEncounter.updateMany({
      where: { userId, languageId, lemma },
      data: { addedWordId: word.id },
    });
  });

  return NextResponse.json({ ok: true });
}
