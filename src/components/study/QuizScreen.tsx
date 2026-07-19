"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Suspense, useMemo, useRef, useState } from "react";

import { EmptyQueue } from "@/components/study/EmptyQueue";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useQueueFetcher } from "@/hooks/useQueueFetcher";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import type { StudyCard } from "@/hooks/useStudySession";
import { audioAvailableFor, playAudio } from "@/lib/audio";
import { gameGloss } from "@/lib/meanings";
import { speechSupported } from "@/lib/speech";
import {
  CARD_TEXT_CLASSES,
  termSizeClass,
  type CardTextSize,
} from "@/lib/textSize";
import { cn } from "@/lib/utils";

type QuizCard = StudyCard & { choices?: string[] };

interface QuizScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
  mode?: "meaning" | "reading";
}

const ADVANCE_MS = 900;
const ADVANCE_WRONG_MS = 1600;

export function QuizScreen({ studyTheme, textSize, mode = "meaning" }: QuizScreenProps) {
  return (
    <Suspense fallback={null}>
      <QuizSession studyTheme={studyTheme} textSize={textSize} mode={mode} />
    </Suspense>
  );
}

function QuizSession({ studyTheme, textSize, mode = "meaning" }: QuizScreenProps) {
  const { query, scoped } = useQueueQuery();
  const practice = true;
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const startedAt = useRef(Date.now()).current;
  const advanceTimer = useRef<number | null>(null);
  const sizes = CARD_TEXT_CLASSES[textSize];

  const { grade, combo, bestCombo, correct, missed } = usePracticeSession({ practice: true });

  const fetchUrl = useMemo(() => {
    const practiceQuery = query.includes("mode=")
      ? query
      : `${query}&mode=practice`;
    return `/api/study/queue?${practiceQuery}&choices=${mode}`;
  }, [query, mode]);

  const { cards: rawCards, loading } = useQueueFetcher(fetchUrl);

  const { cards, skipped } = useMemo(() => {
    const all = rawCards as QuizCard[];
    const usable = all.filter((c) => (c.choices?.length ?? 0) >= 2);
    return { cards: usable, skipped: all.length - usable.length };
  }, [rawCards]);

  const current = cursor < cards.length ? cards[cursor] : null;
  const done = !loading && current === null;

  const answerOf = (c: QuizCard) =>
    mode === "reading" ? c.phonetic ?? "" : gameGloss(c);

  // Reading-mode quiz tests recognizing the pronunciation, so a speaker button
  // there would hand over the answer — only offer it in meaning mode, and
  // only before picking (after that it already auto-plays as feedback).
  const canOfferSpeaker =
    mode === "meaning" && (speechSupported() || audioAvailableFor(current?.languageCode));

  function pick(choice: string) {
    if (!current || picked !== null) return;
    setPicked(choice);
    const isRight = choice === answerOf(current);
    grade(current.wordId, isRight ? 4 : 1, current.term, current.translation);
    // Hear the word at the moment of feedback — the tap is the user gesture
    // that unlocks playback on mobile. Best-effort: no-ops without audio.
    void playAudio(current.term, "word", current.languageCode);
    advanceTimer.current = window.setTimeout(
      advance,
      isRight ? ADVANCE_MS : ADVANCE_WRONG_MS
    );
  }

  function advance() {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setPicked(null);
    setCursor((c) => c + 1);
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
        practice
      />

      <main
        className="flex flex-1 flex-col justify-center px-6 pb-16"
        onClick={() => {
          if (picked !== null) advance();
        }}
      >
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your quiz…
          </p>
        )}

        {done && cards.length === 0 && (
          <div className="flex flex-col items-center gap-3">
            <EmptyQueue scoped={scoped} practice={practice} />
            {skipped > 0 && (
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                {skipped} {skipped === 1 ? "card" : "cards"} can&apos;t be
                quizzed yet — the quiz needs a few more words
                {mode === "reading" ? " with readings" : ""} in the same
                language to build answer options. Try flashcards instead.
              </p>
            )}
          </div>
        )}

        {done && cards.length > 0 && (
          <SessionComplete
            reviewed={cards.length}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={Date.now() - startedAt}
            missed={missed}
            practice
            note={
              skipped > 0
                ? `${skipped} ${skipped === 1 ? "card" : "cards"} couldn't be quizzed (not enough answer options) — review those as flashcards.`
                : undefined
            }
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
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "max-w-full break-normal font-bold leading-tight tracking-tight",
                    termSizeClass(current.term, textSize)
                  )}
                >
                  {current.term}
                </p>
                {picked === null && canOfferSpeaker && (
                  <button
                    type="button"
                    onClick={() =>
                      void playAudio(current.term, "word", current.languageCode)
                    }
                    aria-label="Play pronunciation"
                    className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Volume2 className="size-5" />
                  </button>
                )}
              </div>
              {mode === "meaning" && current.phonetic && (
                <p className={cn("text-muted-foreground", sizes.phoneticHint)}>
                  {current.phonetic}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2">
              {(current.choices ?? []).map((choice) => {
                const isAnswer = choice === answerOf(current);
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
              {picked !== null
                ? "Tap anywhere to continue"
                : mode === "reading"
                  ? "Pick the pronunciation"
                  : "Pick the meaning"}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
