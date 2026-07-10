import Link from "next/link";
import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredAlgorithm: true,
      name: true,
      email: true,
      dailyNewWords: true,
      assumedCheckPerDay: true,
      intervalModifier: true,
      lapseModifier: true,
      masteryThresholdDays: true,
      fuzzIntervals: true,
      theme: true,
      studyTheme: true,
      cardTextSize: true,
      showReading: true,
      soundEffects: true,
      desiredRetention: true,
      targetLanguageId: true,
    },
  });
  if (!user) redirect("/login");

  if (!user.targetLanguageId) {
    redirect("/onboarding");
  }

  const languages = await prisma.language.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsForm
        email={user.email}
        name={user.name}
        preferredAlgorithm={user.preferredAlgorithm}
        dailyNewWords={user.dailyNewWords}
        assumedCheckPerDay={user.assumedCheckPerDay}
        intervalModifier={user.intervalModifier}
        lapseModifier={user.lapseModifier}
        masteryThresholdDays={user.masteryThresholdDays}
        fuzzIntervals={user.fuzzIntervals}
        theme={(user.theme as "light" | "dark" | "system") ?? "system"}
        studyTheme={(user.studyTheme as "dark" | "follow") ?? "dark"}
        cardTextSize={
          (user.cardTextSize as "small" | "normal" | "large") ?? "normal"
        }
        showReading={user.showReading}
        soundEffects={user.soundEffects}
        desiredRetention={user.desiredRetention}
        targetLanguageId={user.targetLanguageId}
        languages={languages}
      />
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    </main>
  );
}
