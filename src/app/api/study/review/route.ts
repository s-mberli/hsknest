import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/session";
import { applyUserModifiers, getAlgorithm } from "@/lib/srs";
import type { CardState, SRSResult, SRSState, UserSRSPrefs } from "@/lib/srs";
import { addDays } from "@/lib/srs";
import { reviewSchema } from "@/lib/validation";

/** Interval granted when an ASSUMED card is confirmed known (before modifiers). */
const ASSUMED_CONFIRMED_INTERVAL_DAYS = 30;

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`review:${userId}`, 1000, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { wordId, quality, reviewedAt, practice } = parsed.data;
  const now = reviewedAt ?? new Date();
  const submittedAt = new Date();

  const [user, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferredAlgorithm: true,
        intervalModifier: true,
        lapseModifier: true,
        masteryThresholdDays: true,
        fuzzIntervals: true,
        desiredRetention: true,
      },
    }),
    prisma.userProgress.findUnique({
      where: { userId_wordId: { userId, wordId } },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!progress) {
    return NextResponse.json(
      { error: "Not enrolled in this word" },
      { status: 404 }
    );
  }

  // Practice/refresh mode: log the review so the streak counts, but leave the
  // SRS schedule (interval/dueAt/state/caps) completely untouched.
  if (practice) {
    await prisma.reviewLog.create({
      data: {
        userId,
        wordId,
        quality,
        algorithm: user.preferredAlgorithm,
        intervalBefore: progress.intervalDays,
        intervalAfter: progress.intervalDays,
        reviewedAt: now,
      },
    });
    return NextResponse.json({
      next: {
        dueAt: progress.dueAt,
        intervalDays: progress.intervalDays,
        state: progress.state,
      },
    });
  }

  const algorithm = getAlgorithm(user.preferredAlgorithm, {
    desiredRetention: user.desiredRetention,
  });

  const currentState: SRSState = {
    state: progress.state as CardState,
    easeFactor: progress.easeFactor,
    intervalDays: progress.intervalDays,
    repetitions: progress.repetitions,
    box: progress.box,
    lapses: progress.lapses,
    dueAt: progress.dueAt,
    lastReviewedAt: progress.lastReviewedAt,
    srsData: (progress.srsData as Record<string, unknown> | null) ?? undefined,
  };

  const prefs: UserSRSPrefs = {
    intervalModifier: user.intervalModifier,
    lapseModifier: user.lapseModifier,
    masteryThresholdDays: user.masteryThresholdDays,
    fuzzIntervals: user.fuzzIntervals,
  };

  let result: SRSResult;

  // Whether this review is a check of an assumed-known card. Drives the daily
  // assumed-check cap (assumedCheckedAt) and prevents the card from counting
  // against the daily NEW budget (introducedAt stays as-is, typically null).
  const isAssumedCheck = currentState.state === "ASSUMED";

  if (isAssumedCheck) {
    // ASSUMED-card check: swipe right = "still known", swipe left = "actually new".
    if (quality >= 3) {
      // Confirmed known — graduate to a long REVIEW interval, then apply modifiers.
      const base: SRSResult = {
        next: {
          ...currentState,
          state: "REVIEW",
          repetitions: 1,
          intervalDays: ASSUMED_CONFIRMED_INTERVAL_DAYS,
          dueAt: addDays(now, ASSUMED_CONFIRMED_INTERVAL_DAYS),
          lastReviewedAt: new Date(now.getTime()),
        },
      };
      result = applyUserModifiers(currentState, base, quality, prefs, now);
    } else {
      // Not actually known — restart as a fresh learning card.
      const initial = algorithm.initialState(now);
      result = {
        next: {
          ...initial,
          state: "LEARNING",
          intervalDays: 1,
          dueAt: addDays(now, 1),
          lastReviewedAt: new Date(now.getTime()),
        },
      };
    }
  } else {
    const raw = algorithm.calculateNextReview(currentState, quality, now);
    result = applyUserModifiers(currentState, raw, quality, prefs, now);
  }

  const { next } = result;

  await prisma.$transaction([
    prisma.userProgress.update({
      where: {
        userId_wordId: { userId, wordId },
        // Dedup: prevent duplicate submission within 5 seconds, allowing null (first review)
        OR: [
          { lastReviewedAt: null },
          { lastReviewedAt: { lt: new Date(submittedAt.getTime() - 5000) } },
        ],
      },
      data: {
        state: next.state,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        box: next.box,
        lapses: next.lapses,
        dueAt: next.dueAt,
        lastReviewedAt: next.lastReviewedAt,
        // Assumed checks must not consume the daily NEW budget, so leave
        // introducedAt untouched; normal reviews stamp it on first sight.
        introducedAt: isAssumedCheck
          ? progress.introducedAt
          : (progress.introducedAt ?? now),
        assumedCheckedAt: isAssumedCheck ? now : progress.assumedCheckedAt,
        srsData: next.srsData
          ? (next.srsData as Prisma.InputJsonValue)
          : undefined,
      },
    }),
    prisma.reviewLog.create({
      data: {
        userId,
        wordId,
        quality,
        algorithm: user.preferredAlgorithm,
        intervalBefore: progress.intervalDays,
        intervalAfter: next.intervalDays,
        reviewedAt: now,
      },
    }),
  ]);

  return NextResponse.json({
    next: {
      dueAt: next.dueAt,
      intervalDays: next.intervalDays,
      state: next.state,
    },
  });
}
