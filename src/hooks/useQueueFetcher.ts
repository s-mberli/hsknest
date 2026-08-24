"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { QueueCounts, StudyCard } from "./useStudySession";

export function useQueueFetcher(
  fetchUrl: string,
  opts?: { filter?: (cards: StudyCard[]) => StudyCard[] }
): {
  cards: StudyCard[];
  /** null until the first fetch resolves. See QueueCounts in useStudySession. */
  counts: QueueCounts | null;
  loading: boolean;
  error: boolean;
} {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => setError(false));
    (async () => {
      try {
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error("queue fetch failed");
        const data = await res.json();
        if (active) {
          const raw: StudyCard[] = data.cards ?? [];
          setCards(opts?.filter ? opts.filter(raw) : raw);
          setCounts(data.counts ?? null);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);

  return { cards, counts, loading, error };
}
