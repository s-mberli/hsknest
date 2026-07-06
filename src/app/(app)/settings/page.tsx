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
    },
  });
  if (!user) redirect("/login");

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
      />
    </main>
  );
}
