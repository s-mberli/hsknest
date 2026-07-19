import { NextResponse } from "next/server";

import { requirePaidUser } from "@/lib/apiRoute";
import { computeDailyCaps, toCards, type QueueCard } from "@/lib/buildQueue";
import { targetLangFilter } from "@/lib/langScope";
import { prioritize } from "@/lib/listPriority";
import { prisma } from "@/lib/prisma";
import { gameGloss } from "@/lib/meanings";
import { buildChoices } from "@/lib/quizChoices";
import { parseQueueQuery, scopeToWordWhere } from "@/lib/studyScope";
import { startOfLocalDay } from "@/lib/utils";

/**
 * Attach one example sentence per card, drawn from the seeded
 * Sentence/SentenceWord links, so any study surface can show it (flashcard
 * reveal, Sentence mode). Cards without a linked sentence are left unchanged.
 * Runs for every queue — game/practice modes simply ignore card.sentence.
 */
async function attachSentences(_url: URL, cards: QueueCard[]): Promise<QueueCard[]> {
  if (cards.length === 0) return cards;

  const links = await prisma.sentenceWord.findMany({
    where: { wordId: { in: cards.map((c) => c.wordId) } },
    select: {
      wordId: true,
      sentence: {
        select: { text: true, translation: true, phonetic: true, source: true },
      },
    },
  });
  const byWord = new Map<string, typeof links>();
  for (const link of links) {
    const list = byWord.get(link.wordId);
    if (list) list.push(link);
    else byWord.set(link.wordId, [link]);
  }
  for (const card of cards) {
    const options = byWord.get(card.wordId);
    if (!options || options.length === 0) continue;
    card.sentence = options[Math.floor(Math.random() * options.length)].sentence;
  }
  return cards;
}

/**
 * Quiz modes attach 4 shuffled answer options per card. ?choices=meaning
 * (legacy "1") draws options from translations; ?choices=reading draws from
 * readings (phonetic) for the pronunciation quiz. Distractors come from other
 * words the user is studying in the same language. No-op without ?choices.
 */
async function attachChoices(
  url: URL,
  cards: QueueCard[],
  userId: string
): Promise<QueueCard[]> {
  const choicesParam = url.searchParams.get("choices");
  const choiceMode =
    choicesParam === "reading"
      ? "reading"
      : choicesParam === "meaning" || choicesParam === "1"
        ? "meaning"
        : null;

  if (!choiceMode || cards.length === 0) return cards;

  const byLanguage = new Map<string, string[]>();
  for (const langCode of new Set(cards.map((c) => c.languageCode))) {
    const pool = await prisma.word.findMany({
      where: {
        wordList: { language: { code: langCode } },
        progress: { some: { userId } },
      },
      select: { translation: true, phonetic: true, metadata: true },
      take: 400,
    });
    const values = pool
      .map((w) =>
        // gameGloss keeps quiz options short and parenthetical-free; the
        // client's answerOf() builds the same string.
        choiceMode === "reading" ? w.phonetic ?? "" : gameGloss(w)
      )
      .filter((v) => v.length > 0);
    byLanguage.set(langCode, [...new Set(values)]);
  }
  for (const card of cards) {
    // Reading quiz can only test cards that have a reading.
    const correct =
      choiceMode === "reading" ? card.phonetic : gameGloss(card);
    if (!correct) continue;
    card.choices = buildChoices(correct, byLanguage.get(card.languageCode) ?? []);
  }
  return cards;
}

export async function GET(req: Request) {
  const userId = await requirePaidUser();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(req.url);
  const { limit, scope } = parseQueueQuery(url.searchParams);
  // Scope is validated against user's visible lists/languages; worst case is an empty queue.
  const scopeWhere = await scopeToWordWhere(scope, userId);

  const now = new Date();
  const dayStart = startOfLocalDay(now);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyNewWords: true, assumedCheckPerDay: true, targetLanguageId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capLangFilter = targetLangFilter(user.targetLanguageId);
  // Sentence mode only makes sense for words with a linked example sentence —
  // narrow the pool so a session fills with usable cards instead of skipping
  // most of them client-side. Pure narrowing filter; scheduling is untouched.
  const sentenceFilter =
    url.searchParams.get("sentences") === "1"
      ? [{ word: { sentences: { some: {} } } }]
      : [];
  const queueWhere = {
    AND: [scopeWhere, capLangFilter, ...sentenceFilter],
  };

  // Include chain so each card carries its language code for TTS.
  const wordInclude = {
    word: { include: { wordList: { include: { language: true } } } },
  } as const;

  // Practice/refresh mode: study already-learned words beyond the daily quota
  // without touching the schedule. Ignores caps entirely; excludes NEW/ASSUMED.
  if (url.searchParams.get("mode") === "practice") {
    const practice = await prisma.userProgress.findMany({
      where: {
        userId,
        state: { in: ["LEARNING", "REVIEW", "LAPSED", "MASTERED"] },
        ...queueWhere,
      },
      orderBy: { dueAt: "asc" },
      take: limit,
      include: wordInclude,
    });
    const practiceCards = toCards(practice, "practice");
    return NextResponse.json({
      cards: await attachSentences(url, await attachChoices(url, practiceCards, userId)),
      counts: { due: 0, newAllowedToday: 0, checksAllowedToday: 0 },
    });
  }

  // 1. Due reviews — never blocked by daily caps.
  const due = await prisma.userProgress.findMany({
    where: {
      userId,
      dueAt: { lte: now },
      state: { in: ["LEARNING", "REVIEW", "LAPSED"] },
      ...queueWhere,
    },
    orderBy: { dueAt: "asc" },
    take: limit,
    include: wordInclude,
  });

  const { newIntroducedToday, assumedCheckedToday } = await computeDailyCaps(
    userId,
    dayStart,
    capLangFilter
  );

  const checksAllowedToday = Math.max(
    0,
    user.assumedCheckPerDay - assumedCheckedToday
  );
  const newAllowedToday = Math.max(0, user.dailyNewWords - newIntroducedToday);

  // Per-user "Studying" list priority order. Prisma can't orderBy a per-user
  // rank stored in a separate table, so we over-fetch a window of candidates
  // (already ordered by word.position asc) and re-sort in JS — see
  // src/lib/listPriority.ts for the rationale and the pure sort helper.
  const priorityRows = await prisma.listPriority.findMany({
    where: { userId },
    orderBy: { rank: "asc" },
    select: { wordListId: true, rank: true },
  });
  const rankByListId = new Map(priorityRows.map((p) => [p.wordListId, p.rank]));

  // 2. Assumed checks.
  let remaining = limit - due.length;
  const checksTake = Math.min(remaining, checksAllowedToday);
  const checks =
    remaining > 0 && checksAllowedToday > 0
      ? prioritize(
          await prisma.userProgress.findMany({
            where: { userId, state: "ASSUMED", ...queueWhere },
            orderBy: { word: { position: "asc" } },
            take: Math.max(checksTake * 5, 50),
            include: wordInclude,
          }),
          rankByListId
        ).slice(0, checksTake)
      : [];

  // 3. New cards.
  remaining = limit - due.length - checks.length;
  const freshTake = Math.min(remaining, newAllowedToday);
  const fresh =
    remaining > 0 && newAllowedToday > 0
      ? prioritize(
          await prisma.userProgress.findMany({
            where: { userId, state: "NEW", ...queueWhere },
            orderBy: { word: { position: "asc" } },
            take: Math.max(freshTake * 5, 50),
            include: wordInclude,
          }),
          rankByListId
        ).slice(0, freshTake)
      : [];

  const cards: QueueCard[] = [
    ...toCards(due, "review"),
    ...toCards(checks, "check"),
    ...toCards(fresh, "new"),
  ];

  return NextResponse.json({
    cards: await attachSentences(url, await attachChoices(url, cards, userId)),
    counts: {
      due: due.length,
      newAllowedToday,
      checksAllowedToday,
    },
  });
}
