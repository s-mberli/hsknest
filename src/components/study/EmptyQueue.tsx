"use client";

import { Moon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { QueueCounts } from "@/hooks/useStudySession";
import { usePracticeRotation } from "@/lib/practiceRotationContext";

interface EmptyQueueProps {
  /** True when the session was narrowed to a language/list selection. */
  scoped: boolean;
  /** True when this was a practice/refresh session (no learned words to show). */
  practice?: boolean;
  /** List ids active in the current scope, so a capped scoped session can
   *  fall back to practice of just those lists. */
  listIds?: string[];
  /** Counts from the queue response — lets us tell "daily cap reached" from
   *  "genuinely nothing left". The practice branch always returns zeroed
   *  counts, so callers pass this only for non-practice sessions. */
  counts?: QueueCounts | null;
}

export function EmptyQueue({
  scoped,
  practice = false,
  listIds = [],
  counts = null,
}: EmptyQueueProps) {
  // Cap-reached is only meaningful for a real (non-practice) session — the
  // practice branch of the queue route always returns newAllowedToday: 0,
  // which would otherwise make every practice empty-state falsely claim a
  // daily limit was hit.
  const capReached = !practice && counts !== null && counts.newAllowedToday === 0;
  const router = useRouter();

  // Non-null only inside PracticeRotationScreen. A mode running its own empty
  // queue mid-rotation (e.g. Sentences has nothing left this round) must not
  // dead-end here — it can hand off to the next round like SessionComplete
  // does. The standalone escape-hatch routes (/study/quiz etc. reached
  // directly) render EmptyQueue with practice=true too, but have no provider
  // above them, so this stays null there and the existing copy is unchanged.
  const rotation = usePracticeRotation();

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
        {practice
          ? rotation
            ? "Nothing left in this round"
            : "Learn a few words first"
          : capReached
            ? "You've hit today's limit"
            : "You've crushed all your flashcards!"}
      </h2>
      <p className="max-w-sm text-muted-foreground">
        {practice
          ? rotation
            ? "This mode ran out of words for the round. Move on to the next one."
            : "These games practice words you've already learned. Study a handful in flashcards first, then come back and they'll unlock."
          : capReached
            ? "You've reached your daily new-word limit — that's your own setting, not a wall. Reviews still come through the moment they're due, and you can raise the limit any time."
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
          <>
            {/* Scoped + caps hit → practice the scope's lists instead of
                dead-ending. mode=practice ignores daily caps but only draws
                from already-learned words (excludes NEW/ASSUMED) — offering
                it when the cap itself is why nothing's here would send the
                user straight into the same "learn some first" dead end,
                so it's withheld specifically for capReached. */}
            {listIds.length > 0 && !practice && !capReached && (
              <Button asChild className="w-full sm:w-auto">
                <Link
                  href={`/study?mode=practice&listIds=${listIds.join(",")}&limit=500`}
                >
                  Practice this list
                </Link>
              </Button>
            )}
            {capReached && (
              <Button asChild className="w-full sm:w-auto">
                <Link href="/settings">Adjust your daily limit</Link>
              </Button>
            )}
            <Button
              variant={listIds.length > 0 && !practice && !capReached ? "outline" : "default"}
              className="w-full sm:w-auto"
              onClick={handleClearScope}
            >
              Clear scope & retry
            </Button>
          </>
        ) : practice ? (
          rotation ? (
            <Button
              className="w-full sm:w-auto"
              onClick={rotation.nextRound}
              disabled={!rotation.nextModeLabel}
            >
              {rotation.nextModeLabel ? `Next round · ${rotation.nextModeLabel}` : "Next round"}
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/study?limit=500">Study flashcards</Link>
            </Button>
          )
        ) : (
          <>
            {/* Finished the real queue → offer schedule-safe practice, not a
                dead "nothing here". Unscoped practice draws from every
                learned word in the account, so unlike the scoped case above
                it's a real option even when the cap is why we're here. */}
            <Button asChild className="w-full sm:w-auto">
              <Link href="/study?mode=practice&limit=500">Keep practicing</Link>
            </Button>
            {capReached ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/settings">Adjust your daily limit</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/lists">Add more words</Link>
              </Button>
            )}
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
