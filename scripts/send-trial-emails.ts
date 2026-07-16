/**
 * Daily trial-lifecycle email job (hosted instance only).
 *
 * Run from the host's cron once a day, e.g.:
 *   npx tsx scripts/send-trial-emails.ts            # send
 *   npx tsx scripts/send-trial-emails.ts --dry-run  # print who would get what
 *
 * Idempotent: each (user, kind) pair is recorded in EmailLog and never sent
 * twice. Guests (@guest.local) have no real inbox and are skipped. Exits
 * immediately on self-hosted installs.
 */
import { PrismaClient } from "@prisma/client";

import { sendTrialEmail, type TrialEmailKind } from "../src/lib/email";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const DAY_MS = 86_400_000;

async function main() {
  if (process.env.SELF_HOSTED !== "false") {
    console.log("[trial-emails] SELF_HOSTED != false — nothing to do.");
    return;
  }

  const now = new Date();

  // One query per kind keeps the windows explicit and cheap at this scale.
  const [welcome, ending, ended] = await Promise.all([
    // Welcome: real accounts created in the last 2 days with a trial clock.
    prisma.user.findMany({
      where: {
        trialEndsAt: { not: null },
        createdAt: { gte: new Date(now.getTime() - 2 * DAY_MS) },
        email: { not: { endsWith: "@guest.local" } },
        emailLogs: { none: { kind: "trial_welcome" } },
      },
      select: { id: true, email: true },
    }),
    // Ending soon: still trialing, clock runs out within 3 days.
    prisma.user.findMany({
      where: {
        subscriptionStatus: "trialing",
        trialEndsAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY_MS) },
        email: { not: { endsWith: "@guest.local" } },
        emailLogs: { none: { kind: "trial_ending" } },
      },
      select: { id: true, email: true, trialEndsAt: true },
    }),
    // Ended: expired within the last 7 days (never nag older accounts).
    prisma.user.findMany({
      where: {
        subscriptionStatus: "trialing",
        trialEndsAt: {
          lte: now,
          gte: new Date(now.getTime() - 7 * DAY_MS),
        },
        email: { not: { endsWith: "@guest.local" } },
        emailLogs: { none: { kind: "trial_ended" } },
      },
      select: { id: true, email: true },
    }),
  ]);

  const jobs: {
    userId: string;
    email: string;
    kind: TrialEmailKind;
    daysLeft?: number;
  }[] = [
    ...welcome.map((u) => ({
      userId: u.id,
      email: u.email,
      kind: "trial_welcome" as const,
    })),
    ...ending.map((u) => ({
      userId: u.id,
      email: u.email,
      kind: "trial_ending" as const,
      daysLeft: Math.max(
        1,
        Math.ceil(((u.trialEndsAt as Date).getTime() - now.getTime()) / DAY_MS)
      ),
    })),
    ...ended.map((u) => ({
      userId: u.id,
      email: u.email,
      kind: "trial_ended" as const,
    })),
  ];

  if (jobs.length === 0) {
    console.log("[trial-emails] Nothing to send.");
    return;
  }

  for (const job of jobs) {
    if (DRY_RUN) {
      console.log(
        `[dry-run] would send ${job.kind} to ${job.email}` +
          (job.daysLeft !== undefined ? ` (${job.daysLeft}d left)` : "")
      );
      continue;
    }
    const result = await sendTrialEmail(job.email, job.kind, job.daysLeft);
    if (result.success) {
      // Log only after a successful send so failures retry tomorrow.
      await prisma.emailLog.create({
        data: { userId: job.userId, kind: job.kind },
      });
      console.log(`[trial-emails] sent ${job.kind} to ${job.email}`);
    } else {
      console.error(`[trial-emails] FAILED ${job.kind} to ${job.email}`);
    }
  }

  console.log(
    `[trial-emails] Done: ${jobs.length} job(s)${DRY_RUN ? " (dry run)" : ""}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
