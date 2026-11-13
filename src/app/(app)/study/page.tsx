import { redirect } from "next/navigation";

import { StudyScreen } from "@/components/study/StudyScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";
import { normalizeCardTextSize } from "@/lib/textSize";

export default async function StudyPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      studyTheme: true,
      cardTextSize: true,
      showReading: true,
      soundEffects: true,
      autoPlayPronunciation: true,
      targetLanguageId: true,
    },
  });
  if (!user) redirect("/login");
  // No language picked yet means no deck: an empty queue here would read as
  // "all done", which is untrue for someone who has not started.
  if (!user.targetLanguageId) redirect("/onboarding");

  // Expired hosted trial: studying is locked (dashboard shows the upgrade path).
  const sub = await getSubscriptionInfo(userId);
  if (!sub.access) redirect("/dashboard");

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";

  return (
    <StudyScreen
      studyTheme={studyTheme}
      textSize={normalizeCardTextSize(user.cardTextSize)}
      showReading={user.showReading}
      soundEffects={user.soundEffects}
      autoPlayPronunciation={user.autoPlayPronunciation}
      isGuest={user.email.endsWith("@guest.local")}
    />
  );
}
