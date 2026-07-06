"use client";

import { motion } from "framer-motion";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyQueue } from "@/components/study/EmptyQueue";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import type { StudyCard } from "@/hooks/useStudySession";
import { postReview } from "@/lib/postReview";
import { CARD_TEXT_CLASSES, type CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

type QuizCard = StudyCard & { choices?: string[] };

interface QuizScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
}

/** Delay before auto-advancing after an answer, long enough to read feedback. */
const ADVANCE_MS = 900;
const ADVANCE_WRONG_MS = 1600;

export function QuizScreen({ studyTheme, textSize }: QuizScreenProps) {
  return (
    <Suspense fallback={null}>
      <QuizSession studyTheme={studyTheme} textSize={textSize} />
    </Suspense>
  );
}

function QuizSession({ studyTheme, textSize }: QuizScreenProps) {
  const { query, scoped } = useQueueQuery();
  const [cards, setCards] = useState<QuizCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const startedAt = useRef(Date.now()).current;
  const sizes = CARD_TEXT_CLASSES[textSize];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/study/queue?${query}&choices=1`);
        if (!res.ok) throw new Error("queue fetch failed");
        const data = await res.json();
        if (active) {
          // Quiz needs real options; skip cards with fewer than 2 choices.
          setCards(
            (data.cards ?? []).filter(
              (c: QuizCard) => (c.choices?.length ?? 0) >= 2
            )
          );
        }
      } catch {
        if (active) toast.error("Could not load your quiz.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  const current = cursor < cards.length ? cards[cursor] : null;
  const done = !loading && current === null;

  function pick(choice: string) {
    if (!current || picked !== null) return;
    setPicked(choice);
    const isRight = choice === current.translation;
    if (isRight) {
      setCorrect((n) => n + 1);
      setCombo((c) => {
        const next = c + 1;
        setBestCombo((b) => Math.max(b, next));
        return next;
      });
    } else {
      setCombo(0);
    }
    void postReview(current.wordId, isRight ? 4 : 1);
    window.setTimeout(
      () => {
        setPicked(null);
        setCursor((c) => c + 1);
      },
      isRight ? ADVANCE_MS : ADVANCE_WRONG_MS
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground",
        studyTheme === "dark" && "dark"
      )}
    >
      <SessionHud
        reviewed={cursor}
        total={cards.length}
        combo={combo}
        startedAt={startedAt}
      />

      <main className="flex flex-1 flex-col justify-center px-6 pb-16">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your quiz…
          </p>
        )}

        {done && cards.length === 0 && <EmptyQueue scoped={scoped} />}

        {done && cards.length > 0 && (
          <SessionComplete
            reviewed={cards.length}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={Date.now() - startedAt}
          />
        )}

        {!loading && current && (
          <motion.div
            key={current.wordId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex w-full max-w-sm flex-col items-center gap-8"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <p
                className={cn(
                  "max-w-full break-words font-bold leading-tight tracking-tight",
                  sizes.term
                )}
              >
                {current.term}
              </p>
              {current.phonetic && (
                <p className={cn("text-muted-foreground", sizes.phonetic)}>
                  {current.phonetic}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2">
              {(current.choices ?? []).map((choice) => {
                const isAnswer = choice === current.translation;
                const isPicked = choice === picked;
                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => pick(choice)}
                    className={cn(
                      "w-full rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors",
                      picked === null && "hover:border-primary/50 hover:bg-accent",
                      // After picking: reveal right/wrong.
                      picked !== null &&
                        isAnswer &&
                        "border-success bg-success/10 text-success",
                      picked !== null &&
                        isPicked &&
                        !isAnswer &&
                        "border-destructive bg-destructive/10 text-destructive",
                      picked !== null && !isPicked && !isAnswer && "opacity-50"
                    )}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Pick the meaning
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
