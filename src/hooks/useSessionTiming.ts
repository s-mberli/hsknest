"use client";

import { useEffect, useState } from "react";

/**
 * Session start time + total elapsed once the session is `done`. Shared by
 * the practice screens (Quiz/Match/Sentence) — `StudyScreen` gets the same
 * shape from `useStudySession` instead, since its timing is already tied to
 * that hook's own state machine.
 */
export function useSessionTiming(done: boolean): {
  startedAt: number;
  elapsedMs: number;
} {
  const [startedAt] = useState(() => Date.now());
  const [endTime, setEndTime] = useState(0);

  useEffect(() => {
    if (done) queueMicrotask(() => setEndTime(Date.now()));
  }, [done]);

  return { startedAt, elapsedMs: endTime ? endTime - startedAt : 0 };
}
