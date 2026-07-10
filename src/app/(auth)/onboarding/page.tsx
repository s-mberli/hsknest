import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { targetLanguageId: true },
  });

  if (user?.targetLanguageId) {
    redirect("/dashboard");
  }

  const languages = await prisma.language.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12 bg-background">
      <OnboardingForm languages={languages} />
    </main>
  );
}
