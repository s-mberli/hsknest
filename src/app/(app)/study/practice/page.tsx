import { redirect } from "next/navigation";

import { PracticeRotationScreen } from "@/components/study/PracticeRotationScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";
import { normalizeCardTextSize } from "@/lib/textSize";
import { getDashboardStats } from "@/lib/stats";
import { getPracticeAvailability } from "@/lib/practiceModes";

/**
 * Practice route: resolves one Practice mode via Rotation and renders that
 * mode's existing screen (unchanged). The learner never picks a mode; they
 * just practise. First round only — round-to-round hand-off is ticket 03.
 *
 * No Review is produced here. Rotation picks a screen; it never touches
 * grading, queueing, or scheduling.
 */
export default async function PracticePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      studyTheme: true,
      cardTextSize: true,
      targetLanguageId: true,
      targetLanguage: { select: { code: true } },
    },
  });
  if (!user) redirect("/login");
  if (!user.targetLanguageId) redirect("/onboarding");

  // Expired hosted trial: studying is locked (dashboard shows the upgrade path).
  const sub = await getSubscriptionInfo(userId);
  if (!sub.access) redirect("/dashboard");

  const searchParams = await props.searchParams;

  // Guard: ensure the route was accessed with mode=practice. SentenceScreen
  // derives practice from the URL via useQueueQuery(), so without the param
  // a sentence round would post a real Review. Make the guarantee uniform.
  const mode = searchParams.mode;
  if (mode !== "practice") {
    redirect("/study/practice?mode=practice&limit=500");
  }

  // Brand-new learner guard: no learned words yet. Don't land them in an empty screen.
  const stats = await getDashboardStats(userId, user.targetLanguageId);
  const learnedTotal = stats.learnedTotal + stats.masteredTotal;
  if (learnedTotal === 0) {
    redirect("/dashboard");
  }

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";
  const textSize = normalizeCardTextSize(user.cardTextSize);

  // Compute which Practice modes are available. Rotation will pick one.
  const availability = getPracticeAvailability({
    languageCode: user.targetLanguage?.code,
    hasSentences: stats.hasSentences,
  });

  return (
    <PracticeRotationScreen
      available={availability.rotatable}
      studyTheme={studyTheme}
      textSize={textSize}
    />
  );
}
