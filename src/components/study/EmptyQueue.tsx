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

  function backToDashboard() {
    // Force the dashboard server component to recompute counts — otherwise the
    // client router cache can show the pre-session ring after studying.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <Moon className="size-14 text-primary" aria-hidden="true" />
      <h2 className="text-2xl font-bold tracking-tight">
        {practice ? "Learn a few words first" : "You've crushed all your flashcards!"}
      </h2>
      <p className="max-w-sm text-muted-foreground">
        {practice
          ? "These games practice words you've already learned. Study a handful in flashcards first, then come back and they'll unlock."
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
        ) : practice ? (
          <Button asChild>
            <Link href="/study">Study flashcards</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/lists">Add more words</Link>
          </Button>
        )}
        <Button variant="outline" onClick={backToDashboard}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
