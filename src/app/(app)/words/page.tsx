import { redirect } from "next/navigation";

import { WordBrowser } from "@/components/words/WordBrowser";
import { getCurrentUserId } from "@/lib/session";

export default async function WordsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Your words</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every word you&apos;ve started, on a memory timeline — from due-now to
        long-term. Switch to By strength or Table anytime.
      </p>
      <WordBrowser />
    </main>
  );
}
