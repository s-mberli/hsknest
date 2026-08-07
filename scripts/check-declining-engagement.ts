/**
 * Weekly declining-engagement nudge (hosted instance only).
 *
 * Ported from Gym Launch Secrets (Alex Hormozi), ch. 16 "The Five Horsemen
 * Of Retention" — see src/lib/engagementDecline.ts for the exact citation
 * and the ported detection rule. The book's own framing: of five retention
 * tactics, this one ("especially the first two") is the highest-leverage,
 * and it must run weekly — "some gym owners run attendance reports
 * monthly. That's way too late."
 *
 * Run from the host's cron once a day (same cadence as
 * send-trial-emails.ts) — the *nudge* stays weekly via the EmailLog dedup
 * key (see weekLabel), so a daily cron doesn't mean a daily email:
 *   npx tsx scripts/check-declining-engagement.ts            # send
 *   npx tsx scripts/check-declining-engagement.ts --dry-run  # print who would get one
 *
 * Idempotent per (user, week): recorded in EmailLog, never sent twice in
 * the same 7-day window. Guests (@guest.local) have no real inbox and are
 * skipped. Exits immediately on self-hosted installs.
 */
import { PrismaClient } from "@prisma/client";

import { isSelfHosted } from "../src/lib/selfHosted";
import { sendDeclineNudgeEmail } from "../src/lib/email";
import { isDeclining, weekLabel } from "../src/lib/engagementDecline";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const DAY_MS = 86_400_000;

async function main() {
  if (isSelfHosted()) {
    console.log("[decline-check] SELF_HOSTED != false — nothing to do.");
    return;
  }

  const now = new Date();
  const kind = weekLabel(now);

  // Candidates: real, engaged (trialing/active — not already canceled)
  // accounts old enough to have a genuine "last week" to compare against,
  // not already nudged this week.
  const candidates = await prisma.user.findMany({
    where: {
      email: { not: { endsWith: "@guest.local" } },
      subscriptionStatus: { in: ["trialing", "active"] },
      createdAt: { lte: new Date(now.getTime() - 14 * DAY_MS) },
      emailLogs: { none: { kind } },
    },
    select: { id: true, email: true },
  });

  if (candidates.length === 0) {
    console.log("[decline-check] No candidates.");
    return;
  }

  // One query for everyone's recent review history, bucketed in JS —
  // mirrors computeStreak's fetch-then-bucket pattern in src/lib/stats.ts.
  const candidateIds = candidates.map((c) => c.id);
  const reviews = await prisma.reviewLog.findMany({
    where: {
      userId: { in: candidateIds },
      reviewedAt: { gte: new Date(now.getTime() - 14 * DAY_MS) },
    },
    select: { userId: true, reviewedAt: true },
  });

  const reviewsByUser = new Map<string, Date[]>();
  for (const r of reviews) {
    const arr = reviewsByUser.get(r.userId) ?? [];
    arr.push(r.reviewedAt);
    reviewsByUser.set(r.userId, arr);
  }

  let sent = 0;
  for (const c of candidates) {
    const reviewedAt = reviewsByUser.get(c.id) ?? [];
    if (!isDeclining({ reviewedAt, now })) continue;

    if (DRY_RUN) {
      console.log(`[dry-run] would send decline nudge to ${c.email}`);
      sent += 1;
      continue;
    }

    const result = await sendDeclineNudgeEmail(c.email);
    if (result.success) {
      // Log only after a successful send so failures retry tomorrow.
      await prisma.emailLog.create({ data: { userId: c.id, kind } });
      console.log(`[decline-check] sent nudge to ${c.email}`);
      sent += 1;
    } else {
      console.error(`[decline-check] FAILED nudge to ${c.email}`);
    }
  }

  console.log(
    `[decline-check] Done: ${sent} sent${DRY_RUN ? " (dry run)" : ""}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
