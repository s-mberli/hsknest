import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { readingDeckBatchSchema } from "@/lib/validation";
import { termKey } from "@/lib/progressMerge";
import { ensureReadingList, resolveWordData } from "@/lib/reading/deckAdd";

/**
 * Post-read batch add: "you looked up N words — add them all?" One request,
 * one transaction, instead of one /api/reading/deck call per word (which
 * would burn through that route's 30/hr rate limit on anything but a very
 * short story). Same dedupe rule as the single-add path — reuses
 * ensureReadingList/resolveWordData from src/lib/reading/deckAdd.ts.
 */
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`deck-batch:${userId}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = readingDeckBatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { languageId, storySlug, items } = parsed.data;

  const lang = await prisma.language.findUnique({ where: { id: languageId }, select: { id: true } });
  if (!lang) return NextResponse.json({ error: "Invalid language" }, { status: 400 });

  // Dedupe within the request itself (first occurrence of a term wins).
  const seenInRequest = new Set<string>();
  const deduped = items.filter((item) => {
    const key = termKey(item.lemma);
    if (seenInRequest.has(key)) return false;
    seenInRequest.add(key);
    return true;
  });

  // Shared-progress dedupe: skip anything already tracked in this language
  // from any list (own or seeded) — same rule as /api/reading/deck.
  const trackedSameLanguage = await prisma.userProgress.findMany({
    where: { userId, word: { wordList: { languageId } } },
    select: { word: { select: { term: true } } },
  });
  const trackedTerms = new Set(trackedSameLanguage.map((p) => termKey(p.word.term)));

  const toAdd = deduped.filter((item) => !trackedTerms.has(termKey(item.lemma)));
  const alreadyTracked = items.length - toAdd.length;

  if (toAdd.length === 0) {
    return NextResponse.json({ added: 0, alreadyTracked, addedLemmas: [] });
  }

  const addedLemmas = await prisma.$transaction(async (tx) => {
    const list = await ensureReadingList(tx, userId, languageId);
    let position = list.wordCount;
    const lemmas: string[] = [];
    for (const item of toAdd) {
      const data = resolveWordData(item, storySlug, position++);
      const word = await tx.word.create({ data: { ...data, wordListId: list.id } });
      await tx.userProgress.create({ data: { userId, wordId: word.id } });
      await tx.wordEncounter.updateMany({
        where: { userId, languageId, lemma: item.lemma },
        data: { addedWordId: word.id },
      });
      lemmas.push(item.lemma);
    }
    return lemmas;
  });

  return NextResponse.json({ added: addedLemmas.length, alreadyTracked, addedLemmas });
}
