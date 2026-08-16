import { NextResponse } from "next/server";

import { logApiError, parseBody, requireUser, unauthorized } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { visibleLanguageWhere } from "@/lib/ownership";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredAlgorithm: true,
      name: true,
      email: true,
      dailyNewWords: true,
      assumedCheckPerDay: true,
      intervalModifier: true,
      lapseModifier: true,
      masteryThresholdDays: true,
      fuzzIntervals: true,
      theme: true,
      studyTheme: true,
      cardTextSize: true,
      characterStyle: true,
      showReading: true,
      soundEffects: true,
      autoPlayPronunciation: true,
      desiredRetention: true,
      targetLanguageId: true,
    },
  });
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const parsed = await parseBody(req, settingsSchema);
  if (parsed instanceof NextResponse) return parsed;

  // A user may only aim their target language at a language they can see
  // (seeded/global, or one they created). Without this, a caller could point
  // their dashboard/queue at another user's private language row (real FK,
  // invisible content) or at a bogus id and get a raw FK crash. Same rule as
  // every other language read path (visibleLanguageWhere).
  if (parsed.targetLanguageId) {
    const visible = await prisma.language.findFirst({
      where: { id: parsed.targetLanguageId, ...visibleLanguageWhere(userId) },
      select: { id: true },
    });
    if (!visible) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: parsed,
      select: {
        preferredAlgorithm: true,
        name: true,
        email: true,
        dailyNewWords: true,
        assumedCheckPerDay: true,
        intervalModifier: true,
        lapseModifier: true,
        masteryThresholdDays: true,
        fuzzIntervals: true,
        theme: true,
        studyTheme: true,
        cardTextSize: true,
        characterStyle: true,
        showReading: true,
        soundEffects: true,
        autoPlayPronunciation: true,
        desiredRetention: true,
        targetLanguageId: true,
      },
    });

    if (parsed.targetLanguageId) {
      const targetLanguageId = parsed.targetLanguageId;
      const enrolledCount = await prisma.userProgress.count({
        where: { userId, word: { wordList: { languageId: targetLanguageId } } },
      });

      if (enrolledCount === 0) {
        const seededLists = await prisma.wordList.findMany({
          where: { languageId: targetLanguageId, createdById: null, isPublic: true },
          select: { id: true, name: true, _count: { select: { words: true } } },
        });

        let starter = seededLists.find((l) => l.name.toLowerCase().includes("starter"));
        if (!starter) {
          starter = seededLists.find((l) => l.name.toLowerCase().includes("foundation"));
        }
        if (!starter) {
          starter = seededLists
            .filter((l) => l._count.words > 0)
            .sort((a, b) => a._count.words - b._count.words)[0];
        }

        if (starter) {
          const words = await prisma.word.findMany({
            where: { wordListId: starter.id },
            select: { id: true },
          });
          const now = new Date();
          await prisma.userProgress.createMany({
            data: words.map((w) => ({ userId, wordId: w.id, dueAt: now })),
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    logApiError("/api/settings", error, userId);
    return NextResponse.json(
      { error: "Could not save settings" },
      { status: 500 }
    );
  }
}
