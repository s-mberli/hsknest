import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { targetLangFilter } from "@/lib/langScope";
import { prisma } from "@/lib/prisma";
import { primaryGloss } from "@/lib/meanings";
import { buildChoices } from "@/lib/quizChoices";
import { parseQueueQuery, scopeToWordWhere } from "@/lib/studyScope";
import { startOfLocalDay } from "@/lib/utils";

interface QueueCard {
  wordId: string;
  term: string;
  translation: string;
  phonetic: string | null;
  metadata: unknown;
  state: string;
  kind: "review" | "check" | "new" | "practice";
  languageCode: string;
  lapses: number;
  choices?: string[];
  sentence?: { text: string; translation: string; source: string | null };
}

/**
 * Sentence mode (?sentences=1) attaches one example sentence per card, drawn
 * from the seeded Sentence/SentenceWord links. Cards without any linked
 * sentence are left unchanged (the sentence screen skips them). No-op
 * without the flag.
 */
async function attachSentences(url: URL, cards: QueueCard[]): Promise<QueueCard[]> {
  if (url.searchParams.get("sentences") !== "1" || cards.length === 0) return cards;

  const links = await prisma.sentenceWord.findMany({
    where: { wordId: { in: cards.map((c) => c.wordId) } },
    select: {
      wordId: true,
      sentence: { select: { text: true, translation: true, source: true } },
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
        choiceMode === "reading" ? w.phonetic ?? "" : primaryGloss(w)
      )
      .filter((v) => v.length > 0);
    byLanguage.set(langCode, [...new Set(values)]);
  }
  for (const card of cards) {
    // Reading quiz can only test cards that have a reading.
    const correct =
      choiceMode === "reading" ? card.phonetic : primaryGloss(card);
    if (!correct) continue;
    card.choices = buildChoices(correct, byLanguage.get(card.languageCode) ?? []);
  }
  return cards;
}

export async function GET(req: Request) {
  const userId = await requireUser();
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

  const toCard = (
    p: {
      wordId: string;
      state: string;
      lapses: number;
      word: {
        term: string;
        translation: string;
        phonetic: string | null;
        metadata: unknown;
        wordList: { language: { code: string } };
      };
    },
    kind: "review" | "check" | "new" | "practice"
  ) => ({
    wordId: p.wordId,
    term: p.word.term,
    translation: p.word.translation,
    phonetic: p.word.phonetic,
    metadata: p.word.metadata,
    state: p.state,
    kind,
    languageCode: p.word.wordList.language.code,
    lapses: p.lapses,
  });

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
    const practiceCards: QueueCard[] = practice.map((p) => toCard(p, "practice"));
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

  // Daily-cap counters: new words introduced today, and assumed-known cards
  // checked today (regardless of the state they landed in after the check).
  // Scoped by target language to match the dashboard (getDashboardStats), which
  // counts within targetLanguageId. Every queue fetch is already constrained to
  // the single targetLanguageId (queueWhere), so there is no cross-language
  // double-spend to guard against — and keeping the cap counts in the same scope
  // as the ring means the ring never promises a card the session then refuses.
  // NOTE: These counts are approximate under concurrent load (race condition
  // possible where two sessions both read count < cap, then both update).
  // This is acceptable for MVP; production should use atomic batch updates.
  const [newIntroducedToday, assumedCheckedToday] = await Promise.all([
    prisma.userProgress.count({
      where: {
        userId,
        introducedAt: { gte: dayStart },
        state: { notIn: ["ASSUMED"] },
        ...capLangFilter,
      },
    }),
    prisma.userProgress.count({
      where: { userId, assumedCheckedAt: { gte: dayStart }, ...capLangFilter },
    }),
  ]);

  const checksAllowedToday = Math.max(
    0,
    user.assumedCheckPerDay - assumedCheckedToday
  );
  const newAllowedToday = Math.max(0, user.dailyNewWords - newIntroducedToday);

  // 2. Assumed checks.
  let remaining = limit - due.length;
  const checks =
    remaining > 0 && checksAllowedToday > 0
      ? await prisma.userProgress.findMany({
          where: { userId, state: "ASSUMED", ...queueWhere },
          orderBy: { word: { position: "asc" } },
          take: Math.min(remaining, checksAllowedToday),
          include: wordInclude,
        })
      : [];

  // 3. New cards.
  remaining = limit - due.length - checks.length;
  const fresh =
    remaining > 0 && newAllowedToday > 0
      ? await prisma.userProgress.findMany({
          where: { userId, state: "NEW", ...queueWhere },
          orderBy: { word: { position: "asc" } },
          take: Math.min(remaining, newAllowedToday),
          include: wordInclude,
        })
      : [];

  const cards: QueueCard[] = [
    ...due.map((p) => toCard(p, "review")),
    ...checks.map((p) => toCard(p, "check")),
    ...fresh.map((p) => toCard(p, "new")),
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
