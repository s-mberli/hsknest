/**
 * Opt-in daily study reminder (hosted instance only).
 *
 * Run once a day from the host's cron (see docs/DEPLOYMENT.md):
 *   npx tsx scripts/send-daily-reminders.ts            # send
 *   npx tsx scripts/send-daily-reminders.ts --dry-run  # print who would get one
 *
 * Sends to users who turned `dailyReminderEmail` on, have access, haven't
 * studied today (review or reading, the streak's definition), and have
 * either cards due or a streak of 2+ days — see shouldSendReminder.
 * "Today" is the server's calendar day, like the dashboard and streak.
 *
 * Idempotent per (user, day) via EmailLog. Guests (@guest.local) are
 * skipped. Exits immediately on self-hosted installs. Needs NEXTAUTH_SECRET
 * in the environment to sign unsubscribe links.
 */
import {
  reminderKind,
  shouldSendReminder,
  unsubscribeSecret,
  unsubscribeUrl,
} from "../src/lib/dailyReminder";
import { sendDailyReminderEmail } from "../src/lib/email";
import { prisma } from "../src/lib/prisma";
import { getActivityDates } from "../src/lib/readingActivity";
import { isSelfHosted } from "../src/lib/selfHosted";
import { computeStreak, countDueCards } from "../src/lib/stats";
import { startOfLocalDay } from "../src/lib/utils";

const DRY_RUN = process.argv.includes("--dry-run");
const DAY_MS = 86_400_000;

async function main() {
  if (isSelfHosted()) {
    console.log("[daily-reminder] SELF_HOSTED != false — nothing to do.");
    return;
  }

  const secret = unsubscribeSecret();
  if (!secret) {
    console.error("[daily-reminder] NEXTAUTH_SECRET is unset — cannot sign unsubscribe links.");
    process.exit(1);
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const now = new Date();
  const kind = reminderKind(now);
  const todayStart = startOfLocalDay(now).getTime();
  // Same 1-year window as the dashboard streak.
  const since = startOfLocalDay(new Date(now.getTime() - 365 * DAY_MS));

  const candidates = await prisma.user.findMany({
    where: {
      dailyReminderEmail: true,
      email: { not: { endsWith: "@guest.local" } },
      subscriptionStatus: { in: ["trialing", "active", "past_due"] },
      // Expired trials can't study, so don't invite them to.
      OR: [
        { subscriptionStatus: { not: "trialing" } },
        { trialEndsAt: null },
        { trialEndsAt: { gt: now } },
      ],
      emailLogs: { none: { kind } },
    },
    select: { id: true, email: true, targetLanguageId: true },
  });

  if (candidates.length === 0) {
    console.log("[daily-reminder] No candidates.");
    return;
  }

  let sent = 0;
  let skipped = 0;
  for (const c of candidates) {
    const [dueCount, activityDates] = await Promise.all([
      countDueCards(c.id, c.targetLanguageId, now),
      getActivityDates(c.id, since),
    ]);
    const studiedToday = activityDates.some(
      (d) => startOfLocalDay(d).getTime() === todayStart
    );
    const streakDays = computeStreak(activityDates);

    if (!shouldSendReminder({ dueCount, streakDays, studiedToday })) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[dry-run] would remind ${c.email} (due ${dueCount}, streak ${streakDays})`
      );
      sent += 1;
      continue;
    }

    const result = await sendDailyReminderEmail(c.email, {
      dueCount,
      streakDays,
      unsubscribeUrl: unsubscribeUrl(baseUrl, c.id, secret),
    });
    if (result.success) {
      // Log only after a successful send so a failure can retry on a re-run.
      await prisma.emailLog.create({ data: { userId: c.id, kind } });
      console.log(`[daily-reminder] sent to ${c.email}`);
      sent += 1;
    } else {
      console.error(`[daily-reminder] FAILED for ${c.email}`);
    }
  }

  console.log(
    `[daily-reminder] Done: ${sent} sent, ${skipped} not needed${DRY_RUN ? " (dry run)" : ""}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
