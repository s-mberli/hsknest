"use client";

import { Moon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

interface EmptyQueueProps {
  /** True when the session was narrowed to a language/list selection. */
  scoped: boolean;
  /** True when this was a practice/refresh session (no learned words to show). */
  practice?: boolean;
}

export function EmptyQueue({ scoped, practice = false }: EmptyQueueProps) {
  const router = useRouter();

  function handleClearScope() {
    try {
      const raw = localStorage.getItem("study-session-choice");
      if (raw) {
        const saved = JSON.parse(raw);
        delete saved.languageId;
        delete saved.listIds;
        localStorage.setItem("study-session-choice", JSON.stringify(saved));
      }
    } catch {}
    router.push("/dashboard");
  }

  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <Moon className="size-14 text-primary" aria-hidden="true" />
      <h2 className="text-2xl font-bold tracking-tight">
        {practice ? "No flashcards to practice yet!" : "You've crushed all your flashcards!"}
      </h2>
      <p className="max-w-sm text-muted-foreground">
        {practice
          ? "Practice mode tests you on words you've already learned. Add some flashcards and study them first, then come back."
          : "Your spaced-repetition queue is empty for now. Add new words to your deck or take a break until your next reviews are due."}
      </p>

      {scoped && (
        <p className="max-w-sm text-sm text-muted-foreground">
          You're currently viewing a filtered deck. Clear your filters on the
          dashboard to see all your flashcards.
        </p>
      )}

      <div className="mt-4 flex gap-3">
        {scoped ? (
          <Button onClick={handleClearScope}>
            Clear scope & retry
          </Button>
        ) : (
          <Button asChild>
            <Link href="/lists">Add more words</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
