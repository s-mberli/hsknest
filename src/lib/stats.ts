import { computeDailyCaps } from "@/lib/buildQueue";
import { targetLangFilter } from "@/lib/langScope";
import { prisma } from "@/lib/prisma";
import { weakProgressWhere } from "@/lib/strength";
import { startOfLocalDay } from "@/lib/utils";

export interface DashboardStats {
  dueCount: number;
  /** Assumed-known cards eligible to be checked today (after the daily cap). */
  checkCount: number;
  newCount: number;
  learnedTotal: number;
  masteredTotal: number;
  weakCount: number;
  streakDays: number;
  dailyNewWords: number;
  newIntroducedToday: number;
  /** Total words the user has ever enrolled (any UserProgress row). */
  enrolledTotal: number;
  /** Reviews coming due over the next 7 days (index 0 = today). */
  forecast: number[];
  /** True when the target language has any example sentences (gates that mode). */
  hasSentences: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FORECAST_DAYS = 7;

export async function getDashboardStats(
  userId: string,
  targetLanguageId: string | null = null
): Promise<DashboardStats> {
  const now = new Date();
  const dayStart = startOfLocalDay(now);
  // End of the 7-day window (exclusive) = start of day+7.
  const windowEnd = new Date(dayStart.getTime() + FORECAST_DAYS * DAY_MS);

  const langFilter = targetLangFilter(targetLanguageId);

  const { newIntroducedToday, assumedCheckedToday } = await computeDailyCaps(
    userId,
    dayStart,
    langFilter
  );

  const [
    user,
    dueCount,
    newCount,
    learnedTotal,
    masteredTotal,
    weakCount,
    assumedTotal,
    enrolledTotal,
    logs,
    forecastRows,
    sentenceCount,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { dailyNewWords: true, assumedCheckPerDay: true },
    }),
    prisma.userProgress.count({
      where: {
        userId,
        dueAt: { lte: now },
        state: { in: ["LEARNING", "REVIEW", "LAPSED"] },
        ...langFilter,
      },
    }),
    prisma.userProgress.count({ where: { userId, state: "NEW", ...langFilter } }),
    prisma.userProgress.count({ where: { userId, state: "REVIEW", ...langFilter } }),
    prisma.userProgress.count({ where: { userId, state: "MASTERED", ...langFilter } }),
    prisma.userProgress.count({
      where: { ...weakProgressWhere(userId), ...langFilter },
    }),
    prisma.userProgress.count({ where: { userId, state: "ASSUMED", ...langFilter } }),
    prisma.userProgress.count({ where: { userId, ...langFilter } }),
    prisma.reviewLog.findMany({
      where: { userId },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: "desc" },
      take: 500,
    }),
    // Single query for the forecast; bucket in JS by local day.
    prisma.userProgress.findMany({
      where: {
        userId,
        dueAt: { lt: windowEnd },
        state: { in: ["LEARNING", "REVIEW", "LAPSED"] },
        ...langFilter,
      },
      select: { dueAt: true },
    }),
    // Does the target language ship any example sentences? Gates the Sentences
    // practice mode so languages without them don't offer an always-empty game.
    targetLanguageId
      ? prisma.sentence.count({ where: { languageId: targetLanguageId } })
      : Promise.resolve(0),
  ]);

  // Bucket reviews into 7 day-slots; anything overdue lumps into today (0).
  const forecast = new Array<number>(FORECAST_DAYS).fill(0);
  for (const row of forecastRows) {
    const diff = Math.floor(
      (startOfLocalDay(row.dueAt).getTime() - dayStart.getTime()) / DAY_MS
    );
    const bucket = Math.min(FORECAST_DAYS - 1, Math.max(0, diff));
    forecast[bucket] += 1;
  }

  // Assumed checks the session would actually surface today (capped).
  const checksAllowedToday = Math.max(
    0,
    (user?.assumedCheckPerDay ?? 0) - assumedCheckedToday
  );
  const checkCount = Math.min(assumedTotal, checksAllowedToday);

  return {
    dueCount,
    checkCount,
    newCount,
    learnedTotal,
    masteredTotal,
    weakCount,
    streakDays: computeStreak(logs.map((l) => l.reviewedAt)),
    dailyNewWords: user?.dailyNewWords ?? 0,
    newIntroducedToday,
    enrolledTotal,
    forecast,
    hasSentences: sentenceCount > 0,
  };
}

export interface LifetimeStats {
  reviews: number;
  daysStudied: number;
  recallRate: number;
  wordsPerDay: number;
}

/**
 * "All time" stats for the dashboard lifetime-stats card. Returns null when the
 * user has never logged a review (nothing meaningful to show yet).
 *
 * NOTE: ReviewLog has no relation to Word in the schema (only a bare `wordId`
 * column), so it can't be joined to word -> wordList -> language in Prisma.
 * `reviews`, `daysStudied`, and `recallRate` are therefore computed across ALL
 * of the user's review history, not scoped to `languageId` — the `languageId`
 * parameter only scopes `wordsPerDay`'s progress-count numerator, which reads
 * UserProgress (joinable via targetLangFilter). If/when ReviewLog grows a
 * `word` relation, these can be scoped too.
 */
export async function getLifetimeStats(
  userId: string,
  languageId: string | null = null
): Promise<LifetimeStats | null> {
  const langFilter = targetLangFilter(languageId);

  const [reviewRows, learnedCount, firstLog] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { userId },
      select: { reviewedAt: true, quality: true },
    }),
    prisma.userProgress.count({
      where: { userId, state: { in: ["LEARNING", "REVIEW", "MASTERED"] }, ...langFilter },
    }),
    prisma.reviewLog.findFirst({
      where: { userId },
      orderBy: { reviewedAt: "asc" },
      select: { reviewedAt: true },
    }),
  ]);

  if (reviewRows.length === 0 || !firstLog) return null;

  const reviews = reviewRows.length;
  const recalled = reviewRows.filter((r) => r.quality >= 3).length;
  const recallRate = Math.round((recalled / reviews) * 100);

  const dayKeys = new Set(
    reviewRows.map((r) => startOfLocalDay(r.reviewedAt).getTime())
  );
  const daysStudied = dayKeys.size;

  const daysSinceFirst = Math.max(
    1,
    Math.ceil(
      (startOfLocalDay(new Date()).getTime() -
        startOfLocalDay(firstLog.reviewedAt).getTime()) /
        DAY_MS
    )
  );
  const wordsPerDay = Math.round((learnedCount / daysSinceFirst) * 10) / 10;

  return { reviews, daysStudied, recallRate, wordsPerDay };
}

/** Count consecutive days (ending today or yesterday) with at least one review. */
export function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const days = new Set(
    dates.map((d) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.getTime();
    })
  );

  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = today.getTime();
  if (!days.has(cursor)) {
    cursor -= DAY_MS;
    if (!days.has(cursor)) return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
