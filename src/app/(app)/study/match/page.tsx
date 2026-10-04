import { redirect } from "next/navigation";

import { MatchScreen } from "@/components/study/MatchScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";
import { normalizeCardTextSize } from "@/lib/textSize";

export default async function MatchPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studyTheme: true, cardTextSize: true, showReading: true, soundEffects: true, autoPlayPronunciation: true },
  });
  if (!user) redirect("/login");

  // Expired hosted trial: studying is locked (dashboard shows the upgrade path).
  const sub = await getSubscriptionInfo(userId);
  if (!sub.access) redirect("/dashboard");

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";

  return <MatchScreen studyTheme={studyTheme} textSize={normalizeCardTextSize(user.cardTextSize)} showReading={user.showReading} soundEffects={user.soundEffects} autoPlayPronunciation={user.autoPlayPronunciation} />;
}
