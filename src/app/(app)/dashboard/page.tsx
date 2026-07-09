import { Flame } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UpgradeBanner } from "@/components/auth/UpgradeBanner";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { Forecast } from "@/components/dashboard/Forecast";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getDashboardStats } from "@/lib/stats";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const [stats, user] = await Promise.all([
    getDashboardStats(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    }),
  ]);
  const isGuest = user?.email.endsWith("@guest.local") ?? false;
  const showVerifyBanner = !isGuest && user && !user.emailVerified;

  // Cap "new" the way the session actually would, so the ring total is honest.
  const newAllowed = Math.max(0, stats.dailyNewWords - stats.newIntroducedToday);
  const fresh = Math.min(stats.newCount, newAllowed);
  const hasCards = stats.dueCount + stats.checkCount + fresh > 0;
  const isNewUser = stats.enrolledTotal === 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Flame className="size-4 text-amber" />
          {stats.streakDays} {stats.streakDays === 1 ? "day" : "days"}
        </span>
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

      <DashboardHero
        due={stats.dueCount}
        checks={stats.checkCount}
        fresh={fresh}
        learnedCount={stats.learnedTotal + stats.masteredTotal}
      />

      <p className="my-6 text-center text-sm text-muted-foreground">
        {stats.newIntroducedToday} of {stats.dailyNewWords} new words today
      </p>

      <Card className="mb-6">
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

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold tabular-nums">
              {stats.learnedTotal}
            </p>
            <p className="text-sm text-muted-foreground">Learned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold tabular-nums">
              {stats.masteredTotal}
            </p>
            <p className="text-sm text-muted-foreground">Mastered</p>
          </CardContent>
        </Card>
        <Link href="/words" className="block">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold tabular-nums text-primary">
                {stats.weakCount}
              </p>
              <p className="text-sm text-muted-foreground">Weak words</p>
            </CardContent>
          </Card>
        </Link>
      </div>

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
