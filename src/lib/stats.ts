import { prisma } from "@/lib/prisma";
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
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FORECAST_DAYS = 7;

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const now = new Date();
  const dayStart = startOfLocalDay(now);
  // End of the 7-day window (exclusive) = start of day+7.
  const windowEnd = new Date(dayStart.getTime() + FORECAST_DAYS * DAY_MS);

  const [
    user,
    dueCount,
    newCount,
    learnedTotal,
    masteredTotal,
    weakCount,
    newIntroducedToday,
    assumedTotal,
    assumedCheckedToday,
    enrolledTotal,
    logs,
    forecastRows,
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
      },
    }),
    prisma.userProgress.count({ where: { userId, state: "NEW" } }),
    prisma.userProgress.count({ where: { userId, state: "REVIEW" } }),
    prisma.userProgress.count({ where: { userId, state: "MASTERED" } }),
    prisma.userProgress.count({
      where: {
        userId,
        lapses: { gte: 3 },
        state: { notIn: ["MASTERED", "ASSUMED"] },
      },
    }),
    prisma.userProgress.count({
      where: {
        userId,
        introducedAt: { gte: dayStart },
        state: { notIn: ["ASSUMED"] },
      },
    }),
    prisma.userProgress.count({ where: { userId, state: "ASSUMED" } }),
    prisma.userProgress.count({
      where: { userId, assumedCheckedAt: { gte: dayStart } },
    }),
    prisma.userProgress.count({ where: { userId } }),
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
      },
      select: { dueAt: true },
    }),
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
  };
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
