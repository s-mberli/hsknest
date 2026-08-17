import { Flame } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UpgradeBanner } from "@/components/auth/UpgradeBanner";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { Forecast } from "@/components/dashboard/Forecast";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { LifetimeStats } from "@/components/dashboard/LifetimeStats";
import { ReviewHeatmap } from "@/components/dashboard/ReviewHeatmap";
import { Card, CardContent } from "@/components/ui/card";
import { ExpiredCard } from "@/components/billing/ExpiredCard";
import { prisma } from "@/lib/prisma";
import { isSelfHosted } from "@/lib/selfHosted";
import { getCurrentUserId } from "@/lib/session";
import { getDashboardStats, getLifetimeStats, type LifetimeStats as LifetimeStatsData } from "@/lib/stats";
import { startOfLocalDay } from "@/lib/utils";
import {
  getSubscriptionInfo,
  syncSubscriptionFromStripe,
} from "@/lib/subscription";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  // Returning from Stripe Checkout: pull the fresh status now so the plan
  // reflects immediately, without waiting on (or depending on) the webhook.
  const { billing } = await searchParams;
  if (billing === "success") {
    await syncSubscriptionFromStripe(userId);
    redirect("/dashboard");
  }

  const now = new Date();
  const [user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerified: true,
        createdAt: true,
        targetLanguageId: true,
        targetLanguage: { select: { code: true } },
      },
    }),
  ]);
  
  // Split "no such user" from "hasn't picked a language yet" — they used to
  // share one check and both fell through to /onboarding. getCurrentUserId()
  // already screens out a stale session (see src/lib/session.ts), so `user`
  // being null here is a narrow race (e.g. deleted between the two queries
  // above) rather than the common case, but conflating it with "needs
  // onboarding" sent a signed-out-in-all-but-cookie user into a form whose
  // submit throws instead of back to a normal login.
  if (!user) {
    redirect("/login");
  }
  if (!user.targetLanguageId) {
    redirect("/onboarding");
  }

  const [stats, sub, lifetimeStats] = await Promise.all([
    getDashboardStats(userId, user.targetLanguageId),
    getSubscriptionInfo(userId),
    getLifetimeStats(userId, user.targetLanguageId),
  ]);

  const isGuest = user?.email.endsWith("@guest.local") ?? false;
  // Self-hosters usually haven't configured Resend, so the "verify" link is
  // unreachable via the UI (only visible in container logs) — nagging them
  // to click a link they can't easily get to is confusing, not helpful.
  const showVerifyBanner =
    !isSelfHosted() && !isGuest && user && !user.emailVerified;

  // Cap "new" the way the session actually would, so the ring total is honest.
  const newAllowed = Math.max(0, stats.dailyNewWords - stats.newIntroducedToday);
  const fresh = Math.min(stats.newCount, newAllowed);
  const hasCards = stats.dueCount + stats.checkCount + fresh > 0;
  const isNewUser = stats.enrolledTotal === 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        {stats.streakDays > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-sm font-medium text-amber">
            <Flame className="size-4" />
            {stats.streakDays} {stats.streakDays === 1 ? "day" : "days"}
          </span>
        )}
      </header>

      {isGuest && (
        <div className="mb-6">
          <UpgradeBanner />
        </div>
      )}

      {showVerifyBanner && (
        <div className="mb-6">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}

      {!sub.access ? (
        <ExpiredCard isGuest={isGuest} />
      ) : (
      <DashboardHero
        due={stats.dueCount}
        checks={stats.checkCount}
        fresh={fresh}
        learnedCount={stats.learnedTotal + stats.masteredTotal}
        weakCount={stats.weakCount}
        dailyNewWords={stats.dailyNewWords}
        newBacklog={Math.max(0, stats.newCount - fresh)}
        languageCode={user.targetLanguage?.code}
        hasSentences={stats.hasSentences}
        isGuest={isGuest}
        createdAt={user?.createdAt}
      />
      )}

      <Card className="mb-6 mt-6">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming schedule
            </p>
            <span className="text-[11px] text-muted-foreground">Next 7 days</span>
          </div>
          <Forecast forecast={stats.forecast} />
        </CardContent>
      </Card>

      <HeatmapSection userId={userId} learnedTotal={stats.learnedTotal} now={now} lifetimeStats={lifetimeStats} weakCount={stats.weakCount} />

      {isNewUser && <div className="mt-6"><GettingStarted /></div>}

      {!isNewUser && !hasCards && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nothing due right now.{" "}
          <Link
            href="/lists"
            className="font-medium text-primary hover:underline"
          >
            Browse word lists
          </Link>{" "}
          to add more.
        </p>
      )}
    </main>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Server-side heatmap data fetcher. Hidden when the user has 0 reviews
 * (progressive disclosure — the heatmap appears as a reward for studying).
 * Uses startOfLocalDay for bucketing so the heatmap and the streak flame
 * always agree on which day "today" is.
 *
 * Merges the heatmap + LifetimeStats into one "Study Activity" card.
 */
async function HeatmapSection({
  userId,
  learnedTotal,
  now,
  lifetimeStats,
  weakCount,
}: {
  userId: string;
  learnedTotal: number;
  now: Date;
  lifetimeStats?: LifetimeStatsData | null;
  weakCount?: number;
}) {
  if (learnedTotal === 0) return null;

  const nineMonthsAgo = startOfLocalDay(new Date(now.getTime() - 270 * DAY_MS));

  const reviews = await prisma.reviewLog.findMany({
    where: { userId, source: "srs", reviewedAt: { gte: nineMonthsAgo } },
    select: { reviewedAt: true, quality: true },
  });

  if (reviews.length === 0) return null;

  // Bucket by local calendar day using startOfLocalDay — same logic as
  // computeStreak, so the heatmap and the streak flame always agree.
  const dayMap = new Map<string, { count: number; correct: number }>();
  for (const r of reviews) {
    const dayKey = startOfLocalDay(r.reviewedAt).toISOString().slice(0, 10);
    const entry = dayMap.get(dayKey) ?? { count: 0, correct: 0 };
    entry.count += 1;
    if (r.quality >= 3) entry.correct += 1;
    dayMap.set(dayKey, entry);
  }

  const days = Array.from(dayMap, ([date, data]) => ({
    date,
    ...data,
  }));

  const totalReviews = reviews.length;
  // Streak from the heatmap's own data (consistent with the day-bucketing).
  let streakDays = 0;
  const today = startOfLocalDay(now).toISOString().slice(0, 10);
  const yesterday = startOfLocalDay(new Date(now.getTime() - DAY_MS)).toISOString().slice(0, 10);
  let cursor = dayMap.has(today) ? today : dayMap.has(yesterday) ? yesterday : "";
  while (cursor && dayMap.has(cursor)) {
    streakDays += 1;
    const d = new Date(cursor + "T12:00:00");
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }

  return (
    <Card className="mb-6 mt-6">
      <CardContent className="pt-6">
        <ReviewHeatmap
          days={days}
          streakDays={streakDays}
        />
        {lifetimeStats && (
          <>
            <div className="my-5 border-t border-border/40" />
            <LifetimeStats stats={lifetimeStats} weakCount={weakCount} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
