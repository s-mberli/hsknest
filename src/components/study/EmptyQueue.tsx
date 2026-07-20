"use client";

import { Moon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface EmptyQueueProps {
  /** True when the session was narrowed to a language/list selection. */
  scoped: boolean;
  /** True when this was a practice/refresh session (no learned words to show). */
  practice?: boolean;
}

export function EmptyQueue({ scoped, practice = false }: EmptyQueueProps) {
  const router = useRouter();

  // Time-orientation for new users: an empty queue reads as a dead end
  // without knowing when the next reviews arrive.
  const [tomorrowDue, setTomorrowDue] = useState<number | null>(null);
  useEffect(() => {
    if (practice) return;
    let cancelled = false;
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((stats) => {
        if (!cancelled && stats && Array.isArray(stats.forecast)) {
          setTomorrowDue(stats.forecast[1] ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [practice]);

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
          : "Your spaced-repetition queue is empty for now. Keep your words fresh with a practice round, add new words, or take a break until your next reviews are due."}
      </p>

      {!practice && tomorrowDue !== null && (
        <p className="max-w-sm text-sm text-muted-foreground">
          {tomorrowDue > 0
            ? `Come back tomorrow — ${tomorrowDue} ${tomorrowDue === 1 ? "review" : "reviews"} will be waiting.`
            : "Nothing due tomorrow — the schedule brings words back right before you'd forget them."}
        </p>
      )}

      {scoped && (
        <p className="max-w-sm text-sm text-muted-foreground">
          You&apos;re currently viewing a filtered deck. Clear your filters on the
          dashboard to see all your flashcards.
        </p>
      )}

      {/* Stack full-width on phones; a wrapping centered row on wider
          screens. Three buttons crammed on one line was unreadable on
          mobile. */}
      <div className="mt-4 flex w-full max-w-xs flex-col gap-2 sm:max-w-md sm:flex-row sm:flex-wrap sm:justify-center">
        {scoped ? (
          <Button className="w-full sm:w-auto" onClick={handleClearScope}>
            Clear scope & retry
          </Button>
        ) : practice ? (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/study?limit=500">Study flashcards</Link>
          </Button>
        ) : (
          <>
            {/* Finished the real queue → offer schedule-safe practice, not a
                dead "nothing here". */}
            <Button asChild className="w-full sm:w-auto">
              <Link href="/study?mode=practice&limit=500">Keep practicing</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/lists">Add more words</Link>
            </Button>
          </>
        )}
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={backToDashboard}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
