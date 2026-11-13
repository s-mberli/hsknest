/**
 * Daily study reminder email: the pure pieces, kept free of Prisma and
 * Next.js so the cron script, the unsubscribe route and the tests share
 * them.
 *
 * "Today" is the server's calendar day, the same day the dashboard, the
 * streak and the daily caps use (see startOfLocalDay). No per-user time zone
 * is stored; the cron line in docs/DEPLOYMENT.md fixes one send time.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Streak length (days) worth protecting with a reminder when nothing is due. */
export const MIN_STREAK_FOR_REMINDER = 2;

export interface ReminderInput {
  /** Review cards due now (same count as the dashboard). */
  dueCount: number;
  /** Current streak from computeStreak (ends today or yesterday). */
  streakDays: number;
  /** Any review or counted reading session today. */
  studiedToday: boolean;
}

/** Send only to people who haven't studied today and have a reason to. */
export function shouldSendReminder({
  dueCount,
  streakDays,
  studiedToday,
}: ReminderInput): boolean {
  if (studiedToday) return false;
  return dueCount > 0 || streakDays >= MIN_STREAK_FOR_REMINDER;
}

/** YYYY-MM-DD of `now` in server-local time. */
export function localDateKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** EmailLog dedup key: at most one reminder per user per day. */
export function reminderKind(now: Date): string {
  return `daily_reminder:${localDateKey(now)}`;
}

// ── Unsubscribe token ────────────────────────────────────────────────────
// HMAC of the user id, keyed by the app secret. No expiry on purpose: an
// unsubscribe link in a months-old email must still work. It grants exactly
// one action (turning the reminder off), so a leaked link can't do harm.

function mac(userId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`daily-reminder-unsubscribe:${userId}`)
    .digest("base64url");
}

export function signUnsubscribeToken(userId: string, secret: string): string {
  if (!secret) throw new Error("unsubscribe token needs a secret");
  return mac(userId, secret);
}

export function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string
): boolean {
  if (!secret || !userId || !token) return false;
  const expected = Buffer.from(mac(userId, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The app secret that signs unsubscribe links (same one NextAuth uses). */
export function unsubscribeSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? "";
}

/** One-click unsubscribe URL; also used as the List-Unsubscribe target. */
export function unsubscribeUrl(baseUrl: string, userId: string, secret: string): string {
  const params = new URLSearchParams({
    u: userId,
    t: signUnsubscribeToken(userId, secret),
  });
  return `${baseUrl}/api/unsubscribe?${params}`;
}
