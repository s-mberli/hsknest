"use client";

import { useCallback, useRef, useState } from "react";

import { breaksStreak, isPass, requeuesInSession } from "@/lib/grading";
import { postReview, type PostReviewOptions } from "@/lib/postReview";

interface UsePracticeSessionOptions {
  practice?: boolean;
  source?: "quiz" | "match" | "sentences" | "ninja";
}

export function usePracticeSession(
  opts: UsePracticeSessionOptions = {}
) {
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [missed, setMissed] = useState<{ term: string; translation: string }[]>([]);
  const [correct, setCorrect] = useState(0);
  const relearning = useRef<Set<string>>(new Set());

  const grade = useCallback(
    (wordId: string, quality: number, term: string, translation: string) => {
      if (isPass(quality)) {
        setCorrect((n) => n + 1);
        setCombo((c) => {
          const next = c + 1;
          setBestCombo((b) => Math.max(b, next));
          return next;
        });
      } else {
        setCombo(0);
      }
      if (breaksStreak(quality)) {
        setMissed((m) =>
          m.some((w) => w.term === term)
            ? m
            : [...m, { term, translation }]
        );
      }

      const isRepeat = relearning.current.has(wordId);
      if (requeuesInSession(quality)) {
        relearning.current.add(wordId);
      }

      const reviewOpts: PostReviewOptions = {
        practice: opts.practice || isRepeat,
        ...(opts.source ? { source: opts.source } : {}),
      };
      void postReview(wordId, quality, reviewOpts);
    },
    [opts.practice, opts.source]
  );

  const isRelearning = useCallback(
    (wordId: string) => relearning.current.has(wordId),
    []
  );

  const markRelearned = useCallback((wordId: string) => {
    relearning.current.add(wordId);
  }, []);

  const resetForNewSession = useCallback(() => {
    setCombo(0);
    setBestCombo(0);
    setMissed([]);
    setCorrect(0);
    relearning.current.clear();
  }, []);

  return {
    grade,
    combo,
    bestCombo,
    missed,
    correct,
    isRelearning,
    markRelearned,
    resetForNewSession,
  };
}
