import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

// Launch scope: new users onboard into Mandarin only. Other seeded languages
// stay in the DB and remain switchable in Settings — this only trims the
// first-run picker. Widen this list to re-open a language at signup.
const LAUNCH_LANGUAGE_CODES = ["zh"];

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
    where: { code: { in: LAUNCH_LANGUAGE_CODES } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  // Seeded HSK level decks for the "where are you starting?" step, in level
  // order (names are stable seed content: "HSK 1 — Foundation" … "HSK 7–9 —
  // Mastery").
  const zh = languages.find((l) => l.code === "zh");
  const hskLists = zh
    ? (
        await prisma.wordList.findMany({
          where: {
            languageId: zh.id,
            createdById: null,
            name: { startsWith: "HSK " },
          },
          select: { id: true, name: true },
        })
      ).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    : [];

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12 bg-background">
      <OnboardingForm languages={languages} hskLists={hskLists} />
    </main>
  );
}
