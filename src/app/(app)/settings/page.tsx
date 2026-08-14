import Link from "next/link";
import { redirect } from "next/navigation";

import { UpgradeBanner } from "@/components/auth/UpgradeBanner";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { BillingSection } from "@/components/settings/sections/BillingSection";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSubscriptionInfo } from "@/lib/subscription";

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      dailyNewWords: true,
      assumedCheckPerDay: true,
      theme: true,
      studyTheme: true,
      cardTextSize: true,
      characterStyle: true,
      showReading: true,
      soundEffects: true,
      autoPlayPronunciation: true,
      desiredRetention: true,
      targetLanguageId: true,
    },
  });
  if (!user) redirect("/login");

  if (!user.targetLanguageId) {
    redirect("/onboarding");
  }

  const isGuest = user.email.endsWith("@guest.local");

  const [languages, sub] = await Promise.all([
    prisma.language.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getSubscriptionInfo(userId),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsForm
        email={user.email}
        name={user.name}
        dailyNewWords={user.dailyNewWords}
        assumedCheckPerDay={user.assumedCheckPerDay}
        theme={(user.theme as "light" | "dark" | "system") ?? "system"}
        studyTheme={(user.studyTheme as "dark" | "follow") ?? "dark"}
        cardTextSize={
          (user.cardTextSize as "small" | "normal" | "large") ?? "normal"
        }
        characterStyle={
          (user.characterStyle as "modern" | "academic") ?? "modern"
        }
        showReading={user.showReading}
        soundEffects={user.soundEffects}
        autoPlayPronunciation={user.autoPlayPronunciation}
        desiredRetention={user.desiredRetention}
        targetLanguageId={user.targetLanguageId}
        languages={languages}
        topSlot={
          isGuest ? (
            // A guest hasn't committed to an account yet, so the urgent action
            // is claiming one before the progress is stranded — not paying.
            // Applies self-hosted or hosted: a self-hoster who reopened guest
            // mode via ALLOW_REGISTRATION still needs this nudge, just with
            // no billing attached.
            <UpgradeBanner compact />
          ) : sub.selfHosted ? undefined : (
            <BillingSection
              status={sub.status}
              daysLeft={sub.daysLeft}
              hasStripeCustomer={sub.hasStripeCustomer}
            />
          )
        }
      />
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/credits" className="underline underline-offset-2 hover:text-foreground">
          Data Credits
        </Link>
      </p>
    </main>
  );
}
