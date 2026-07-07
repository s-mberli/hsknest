"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface StudyCard {
  wordId: string;
  term: string;
  translation: string;
  phonetic: string | null;
  metadata: Record<string, unknown> | null;
  state: string;
  kind?: string;
  languageCode?: string;
  lapses?: number;
}

/** Reveal stages of a card. Phonetic-less words skip PHONETIC. */
export type Stage = "TERM" | "PHONETIC" | "FULL";

/** Grade gestures map to SM-2 qualities. */
export type SwipeDirection = "left" | "right" | "up" | "down";

const QUALITY_BY_DIRECTION: Record<SwipeDirection, number> = {
  left: 1, // forgot
  right: 4, // knew
  up: 5, // easy
  down: 3, // hard / barely
};

interface UseStudySession {
  loading: boolean;
  cards: StudyCard[];
  current: StudyCard | null;
  upcoming: StudyCard[];
  stage: Stage;
  remaining: number;
  reviewed: number;
  combo: number;
  bestCombo: number;
  correct: number;
  /** Cards graded wrong this session (deduped), for the session summary. */
  missed: { term: string; translation: string }[];
  done: boolean;
  /** Advance the reveal stage (tap / Space). */
  advance: () => void;
  /** Grade the current card (only meaningful at FULL). */
  swipe: (direction: SwipeDirection) => void;
}

/** Next reveal stage for a card; phonetic-less words jump straight to FULL. */
function nextStage(stage: Stage, card: StudyCard | null): Stage {
  if (stage === "TERM") return card?.phonetic ? "PHONETIC" : "FULL";
  return "FULL";
}

/** `query` is the queue query string, e.g. "limit=10" or "minutes=5". */
export function useStudySession(query = "limit=20"): UseStudySession {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<Stage>("TERM");
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<{ term: string; translation: string }[]>(
    []
  );
  const requeued = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/study/queue?${query}`);
        if (!res.ok) throw new Error("queue fetch failed");
        const data = await res.json();
        if (active) setCards(data.cards ?? []);
      } catch {
        if (active) toast.error("Could not load your study session.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  const current = cursor < cards.length ? cards[cursor] : null;
  const upcoming = cards.slice(cursor + 1, cursor + 3);
  const done = !loading && current === null;

  const advance = useCallback(() => {
    setStage((s) => nextStage(s, current));
  }, [current]);

  const swipe = useCallback(
    (direction: SwipeDirection) => {
      const card = cards[cursor];
      if (!card) return;

      const quality = QUALITY_BY_DIRECTION[direction];

      // Combo: consecutive q>=3 this session; resets quietly otherwise.
      if (quality >= 3) {
        setCombo((c) => {
          const next = c + 1;
          setBestCombo((b) => Math.max(b, next));
          return next;
        });
        setCorrect((n) => n + 1);
      } else {
        setCombo(0);
        setMissed((m) =>
          m.some((w) => w.term === card.term)
            ? m
            : [...m, { term: card.term, translation: card.translation }]
        );
      }

      // Optimistic: advance immediately, post in the background.
      setCursor((c) => c + 1);
      setStage("TERM");
      setReviewed((r) => r + 1);

      void (async () => {
        const body = JSON.stringify({
          wordId: card.wordId,
          quality,
          reviewedAt: new Date().toISOString(),
        });

        const post = () =>
          fetch("/api/study/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

        // Re-queue the card once at the end so progress isn't silently lost.
        const requeue = () => {
          if (!requeued.current.has(card.wordId)) {
            requeued.current.add(card.wordId);
            setCards((prev) => [...prev, card]);
            setReviewed((r) => Math.max(0, r - 1));
          }
        };

        try {
          const res = await post();
          if (res.ok) return;

          // Stale card (progress wiped elsewhere): drop silently.
          if (res.status === 404) return;

          // Transient server errors: retry once, then requeue + toast.
          if (res.status >= 500) {
            await new Promise((r) => setTimeout(r, 1500));
            const retry = await post();
            if (retry.ok) return;
            requeue();
            toast.error("Couldn't save that review — we'll ask again.");
            return;
          }

          // Other 4xx (validation etc.): won't succeed on replay. Toast, no requeue.
          toast.error("Couldn't save that review.");
        } catch {
          // Network error: retry once, then requeue + toast.
          await new Promise((r) => setTimeout(r, 1500));
          try {
            const retry = await post();
            if (retry.ok) return;
            if (retry.status === 404) return;
          } catch {
            // fall through to requeue
          }
          requeue();
          toast.error("Couldn't save that review — we'll ask again.");
        }
      })();
    },
    [cards, cursor]
  );

  return {
    loading,
    cards,
    current,
    upcoming,
    stage,
    remaining: Math.max(0, cards.length - cursor),
    reviewed,
    combo,
    bestCombo,
    correct,
    missed,
    done,
    advance,
    swipe,
  };
}
