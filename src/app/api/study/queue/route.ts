import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildChoices } from "@/lib/quizChoices";
import { getCurrentUserId } from "@/lib/session";
import { parseQueueQuery, scopeToWordWhere } from "@/lib/studyScope";
import { startOfLocalDay } from "@/lib/utils";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const { limit, scope } = parseQueueQuery(url.searchParams);
  // Scope only narrows the caller's own UserProgress rows (userId is always
  // ANDed in below), so no ownership check is needed — worst case is an empty queue.
  const scopeWhere = scopeToWordWhere(scope);

  const now = new Date();
  const dayStart = startOfLocalDay(now);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyNewWords: true, assumedCheckPerDay: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Include chain so each card carries its language code for TTS.
  const wordInclude = {
    word: { include: { wordList: { include: { language: true } } } },
  } as const;

  // 1. Due reviews — never blocked by daily caps.
  const due = await prisma.userProgress.findMany({
    where: {
      userId,
      dueAt: { lte: now },
      state: { in: ["LEARNING", "REVIEW", "LAPSED"] },
      ...scopeWhere,
    },
    orderBy: { dueAt: "asc" },
    take: limit,
    include: wordInclude,
  });

  // Daily-cap counters: new words introduced today, and assumed-known cards
  // checked today (regardless of the state they landed in after the check).
  // INVARIANT: these two counts are intentionally NOT scoped. Daily caps are
  // global per day — the review route stamps introducedAt/assumedCheckedAt at
  // grade time regardless of scope, so counting globally prevents double-spend
  // across differently-scoped sessions on the same day.
  const [newIntroducedToday, assumedCheckedToday] = await Promise.all([
    prisma.userProgress.count({
      where: {
        userId,
        introducedAt: { gte: dayStart },
        state: { notIn: ["ASSUMED"] },
      },
    }),
    prisma.userProgress.count({
      where: { userId, assumedCheckedAt: { gte: dayStart } },
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
          where: { userId, state: "ASSUMED", ...scopeWhere },
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
          where: { userId, state: "NEW", ...scopeWhere },
          orderBy: { word: { position: "asc" } },
          take: Math.min(remaining, newAllowedToday),
          include: wordInclude,
        })
      : [];

  const toCard = (
    p: (typeof due)[number],
    kind: "review" | "check" | "new"
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

  const cards: (ReturnType<typeof toCard> & { choices?: string[] })[] = [
    ...due.map((p) => toCard(p, "review")),
    ...checks.map((p) => toCard(p, "check")),
    ...fresh.map((p) => toCard(p, "new")),
  ];

  // Quiz modes attach 4 shuffled answer options per card. ?choices=meaning
  // (legacy "1") draws options from translations; ?choices=reading draws from
  // readings (phonetic) for the pronunciation quiz. Distractors come from other
  // words the user is studying in the same language.
  const choicesParam = url.searchParams.get("choices");
  const choiceMode =
    choicesParam === "reading"
      ? "reading"
      : choicesParam === "meaning" || choicesParam === "1"
        ? "meaning"
        : null;

  if (choiceMode && cards.length > 0) {
    const byLanguage = new Map<string, string[]>();
    for (const langCode of new Set(cards.map((c) => c.languageCode))) {
      const pool = await prisma.word.findMany({
        where: {
          wordList: { language: { code: langCode } },
          progress: { some: { userId } },
        },
        select: { translation: true, phonetic: true },
        take: 400,
      });
      const values = pool
        .map((w) =>
          choiceMode === "reading" ? w.phonetic ?? "" : w.translation
        )
        .filter((v) => v.length > 0);
      byLanguage.set(langCode, [...new Set(values)]);
    }
    for (const card of cards) {
      // Reading quiz can only test cards that have a reading.
      const correct =
        choiceMode === "reading" ? card.phonetic : card.translation;
      if (!correct) continue;
      card.choices = buildChoices(correct, byLanguage.get(card.languageCode) ?? []);
    }
  }

  return NextResponse.json({
    cards,
    counts: {
      due: due.length,
      newAllowedToday,
      checksAllowedToday,
    },
  });
}
