import { redirect } from "next/navigation";

import { QuizScreen } from "@/components/study/QuizScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";
import { normalizeCardTextSize } from "@/lib/textSize";

/** Pronunciation quiz: see the term, pick how it's read. */
export default async function PronouncePage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studyTheme: true, cardTextSize: true },
  });
  if (!user) redirect("/login");

  // Expired hosted trial: studying is locked (dashboard shows the upgrade path).
  const sub = await getSubscriptionInfo(userId);
  if (!sub.access) redirect("/dashboard");

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";

  return (
    <QuizScreen
      studyTheme={studyTheme}
      textSize={normalizeCardTextSize(user.cardTextSize)}
      mode="reading"
    />
  );
}
