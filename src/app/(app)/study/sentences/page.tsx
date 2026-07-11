import { redirect } from "next/navigation";

import { SentenceScreen } from "@/components/study/SentenceScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { normalizeCardTextSize } from "@/lib/textSize";

export default async function SentencesPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studyTheme: true, cardTextSize: true },
  });
  if (!user) redirect("/login");

  const studyTheme = user.studyTheme === "follow" ? "follow" : "dark";

  return (
    <SentenceScreen
      studyTheme={studyTheme}
      textSize={normalizeCardTextSize(user.cardTextSize)}
    />
  );
}
