import { redirect } from "next/navigation";

import { QuizScreen } from "@/components/study/QuizScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { normalizeCardTextSize } from "@/lib/textSize";

export default async function QuizPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studyTheme: true, cardTextSize: true },
  });
  if (!user) redirect("/login");

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";

  return (
    <QuizScreen
      studyTheme={studyTheme}
      textSize={normalizeCardTextSize(user.cardTextSize)}
    />
  );
}
