import { redirect } from "next/navigation";

import { NinjaScreen } from "@/components/study/NinjaScreen";
import { prisma } from "@/lib/prisma";
import { ninjaEnabled } from "@/lib/ninja/flag";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";

export default async function NinjaPage() {
  if (!ninjaEnabled()) redirect("/dashboard");

  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studyTheme: true, soundEffects: true },
  });
  if (!user) redirect("/login");

  // Expired hosted trial: studying is locked (dashboard shows the upgrade path).
  const sub = await getSubscriptionInfo(userId);
  if (!sub.access) redirect("/dashboard");

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";

  return <NinjaScreen studyTheme={studyTheme} soundEffects={user.soundEffects} />;
}
