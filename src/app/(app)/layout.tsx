import { redirect } from "next/navigation";

import { BottomNav } from "@/components/BottomNav";
import { ThemeSync } from "@/components/ThemeSync";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { theme: true },
    }),
    getSubscriptionInfo(userId),
  ]);

  const showTrialBanner =
    !sub.selfHosted &&
    sub.status === "trialing" &&
    sub.daysLeft !== null &&
    sub.access;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ThemeSync theme={user?.theme ?? "system"} />
      {showTrialBanner && <TrialBanner daysLeft={sub.daysLeft as number} />}
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </div>
  );
}
