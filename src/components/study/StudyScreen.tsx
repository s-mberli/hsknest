"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useRef } from "react";

import { CardStack } from "@/components/study/CardStack";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { useStudySession } from "@/hooks/useStudySession";
import { cn } from "@/lib/utils";

interface StudyScreenProps {
  studyTheme: "dark" | "follow";
}

export function StudyScreen({ studyTheme }: StudyScreenProps) {
  return (
    <Suspense fallback={null}>
      <StudySession studyTheme={studyTheme} />
    </Suspense>
  );
}

/**
 * Build a queue query string from the URL: ?minutes=M wins, else ?limit=N,
 * plus any scope params (?languageId, ?listIds) passed straight through.
 */
function useQueueQuery(): { query: string; scoped: boolean } {
  const params = useSearchParams();

  const parts: string[] = [];
  const minutes = Number(params.get("minutes"));
  if (Number.isFinite(minutes) && minutes > 0) {
    parts.push(`minutes=${Math.floor(minutes)}`);
  } else {
    const limit = Number(params.get("limit"));
    parts.push(
      Number.isFinite(limit) && limit > 0 ? `limit=${Math.floor(limit)}` : "limit=20"
    );
  }

  const languageId = params.get("languageId");
  const listIds = params.get("listIds");
  if (languageId) parts.push(`languageId=${encodeURIComponent(languageId)}`);
  if (listIds) parts.push(`listIds=${encodeURIComponent(listIds)}`);

  return { query: parts.join("&"), scoped: Boolean(languageId || listIds) };
}

function StudySession({ studyTheme }: StudyScreenProps) {
  const { query, scoped } = useQueueQuery();
  const {
    loading,
    cards,
    current,
    upcoming,
    stage,
    reviewed,
    combo,
    bestCombo,
    correct,
    done,
    advance,
    swipe,
  } = useStudySession(query);

  const startedAt = useRef(Date.now()).current;

  return (
    // Full-screen distraction-free study. "dark" forces focus mode; "follow"
    // inherits next-themes' class on <html>.
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground",
        studyTheme === "dark" && "dark"
      )}
    >
      <SessionHud
        reviewed={reviewed}
        total={cards.length}
        combo={combo}
        startedAt={startedAt}
      />

      <main className="flex flex-1 flex-col justify-center px-6 pb-16">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your cards…
          </p>
        )}

        {!loading && done && cards.length === 0 && (
          <EmptyQueue scoped={scoped} />
        )}

        {!loading && done && cards.length > 0 && (
          <SessionComplete
            reviewed={reviewed}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={Date.now() - startedAt}
          />
        )}

        {!loading && current && (
          <div className="flex flex-col items-center gap-8">
            <CardStack
              current={current}
              upcoming={upcoming}
              stage={stage}
              onAdvance={advance}
              onSwipe={swipe}
            />

            <p className="text-center text-xs text-muted-foreground">
              Tap to reveal · at the answer, swipe or use ← → ↑ ↓ to grade
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
