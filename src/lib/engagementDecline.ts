import { startOfLocalDay } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ported from Gym Launch Secrets (Alex Hormozi), ch. 16 "The Five Horsemen
 * Of Retention": "The #1 leading indicator that a customer is on the track
 * to cancellation is when they make it to the gym two times or less in a
 * week... Some gym owners run attendance reports monthly. That's way too
 * late... you should know who hasn't shown up by Wednesday of every week."
 *
 * Ported as: 2-or-fewer distinct study days this week, down from a
 * genuinely active (3+) week before. Distinct *days*, not raw review count,
 * to mirror "visits" rather than volume — matches computeStreak's bucketing
 * in src/lib/stats.ts.
 */
export function isDeclining(input: { reviewedAt: Date[]; now: Date }): boolean {
  const { reviewedAt, now } = input;
  const todayStart = startOfLocalDay(now).getTime();
  const weekStart = todayStart - 7 * DAY_MS;
  const twoWeeksStart = todayStart - 14 * DAY_MS;
  const windowEnd = todayStart + DAY_MS; // include all of "today"

  const thisWeek = distinctDaysInWindow(reviewedAt, weekStart, windowEnd);
  const lastWeek = distinctDaysInWindow(reviewedAt, twoWeeksStart, weekStart);

  return lastWeek >= 3 && thisWeek <= 2 && thisWeek < lastWeek;
}

function distinctDaysInWindow(dates: Date[], start: number, end: number): number {
  const days = new Set(
    dates
      .filter((d) => d.getTime() >= start && d.getTime() < end)
      .map((d) => startOfLocalDay(d).getTime())
  );
  return days.size;
}

/**
 * Stable dedup key for EmailLog, rolling over every 7 days from the Unix
 * epoch. The check script runs daily (like send-trial-emails.ts) but this
 * keeps the nudge itself weekly — a user who's still declining next week
 * gets a new key and can be emailed again; the same week never double-sends.
 * Deliberately not calendar/ISO weeks: no per-user timezone is stored
 * anywhere in this app (see startOfLocalDay), so there's nothing to align
 * to — a fixed-length rolling window is simpler and just as correct here.
 */
export function weekLabel(now: Date): string {
  const epochWeek = Math.floor(now.getTime() / (7 * DAY_MS));
  return `decline_w${epochWeek}`;
}
