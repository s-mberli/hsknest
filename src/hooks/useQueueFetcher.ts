"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { QueueCounts, StudyCard } from "./useStudySession";
import { queueResponseSchema } from "@/lib/queueResponse";

export function useQueueFetcher(
  fetchUrl: string,
  opts?: { filter?: (cards: StudyCard[]) => StudyCard[] }
): {
  cards: StudyCard[];
  /** null until the first fetch resolves. See QueueCounts in useStudySession. */
  counts: QueueCounts | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  retryOmitted: number;
} {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [retryOmitted, setRetryOmitted] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!active) return;
      setError(false);
      setLoading(true);
      setCards([]);
      setCounts(null);
      setRetryOmitted(0);
    });
    (async () => {
      try {
        const res = await fetch(fetchUrl, { signal: controller.signal });
        if (!res.ok) throw new Error("queue fetch failed");
        const data = queueResponseSchema.parse(await res.json());
        if (active) {
          const raw: StudyCard[] = data.cards ?? [];
          setCards(opts?.filter ? opts.filter(raw) : raw);
          setCounts(data.counts ?? null);
          setRetryOmitted(data.retryOmitted);
        }
      } catch {
        if (active) {
          toast.error("Could not load your study session.");
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, attempt]);

  return { cards, counts, loading, error, retryOmitted, retry: () => setAttempt((n) => n + 1) };
}
