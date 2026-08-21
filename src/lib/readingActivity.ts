/**
 * Union of two activity signals for streak/heatmap purposes ONLY:
 * ReviewLog (any source — matches the heatmap's pre-existing all-source
 * query, which was never scoped to source:"srs" the way stats.ts's
 * recallRate/lifetime numbers are) and ReadingSession rows that clear a
 * noise floor.
 *
 * Deliberately NOT used for recallRate, lifetime `reviews`, or
 * `daysStudied` in getLifetimeStats — those stay ReviewLog(source:"srs")
 * only, because a reading session has no graded recall to report and
 * mixing it in would inflate an accuracy metric with ungraded exposure.
 *
 * This is the ONE place both streak call sites (src/lib/stats.ts's
 * getDashboardStats, and the dashboard page's inlined heatmap section)
 * should read from, so they can't drift out of agreement on what counts as
 * "the user did something today."
 */
import { prisma } from "@/lib/prisma";

/** Sessions shorter than this are noise (accidental open/immediate back). */
export const MIN_READING_SESSION_MS = 5_000;

export interface ActivityDay {
  /** YYYY-MM-DD, local calendar day */
  date: string;
  reviewCount: number;
  correctCount: number;
  readingCount: number;
}

function dayKey(d: Date): string {
  const local = new Date(d);
  local.setHours(0, 0, 0, 0);
  return local.toISOString().slice(0, 10);
}

/**
 * Per-local-day activity buckets since `since`, for heatmap rendering.
 * `reviewCount`/`correctCount` come from ReviewLog (any source);
 * `readingCount` counts ReadingSession rows meeting the noise floor.
 */
export async function getActivityDayBuckets(
  userId: string,
  since: Date
): Promise<Map<string, ActivityDay>> {
  const [reviews, sessions] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: since } },
      select: { reviewedAt: true, quality: true },
    }),
    prisma.readingSession.findMany({
      where: {
        userId,
        startedAt: { gte: since },
        durationMs: { gte: MIN_READING_SESSION_MS },
      },
      select: { startedAt: true },
    }),
  ]);

  const days = new Map<string, ActivityDay>();
  const get = (key: string) => {
    let d = days.get(key);
    if (!d) { d = { date: key, reviewCount: 0, correctCount: 0, readingCount: 0 }; days.set(key, d); }
    return d;
  };

  for (const r of reviews) {
    const d = get(dayKey(r.reviewedAt));
    d.reviewCount += 1;
    if (r.quality >= 3) d.correctCount += 1;
  }
  for (const s of sessions) {
    get(dayKey(s.startedAt)).readingCount += 1;
  }

  return days;
}

/**
 * Local-calendar-day dates with any activity (review or reading) since
 * `since`, for computeStreak. One Date per distinct active day is enough —
 * computeStreak only cares about which days had >=1 entry.
 */
export async function getActivityDates(userId: string, since: Date): Promise<Date[]> {
  const buckets = await getActivityDayBuckets(userId, since);
  return [...buckets.keys()].map((k) => new Date(`${k}T12:00:00`));
}
