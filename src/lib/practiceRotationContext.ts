"use client";

import { createContext, useContext } from "react";

/**
 * Context passed to SessionComplete and other descendants of
 * PracticeRotationScreen. When present, SessionComplete alters its action row:
 * "Next round" replaces "Keep practicing", and exit is made explicit.
 *
 * Null outside a Practice rotation (the normal case), so standalone
 * /study/quiz etc. routes keep working unchanged.
 */
export interface PracticeRotationContextValue {
  /** Advance to the next round in a different mode. */
  nextRound: () => void;
  /** Label of the mode about to be played, for the button copy (e.g. "Word Match"). */
  nextModeLabel: string | null;
}

export const PracticeRotationContext = createContext<PracticeRotationContextValue | null>(
  null
);

/**
 * Hook for descendant components to consume the practice rotation context.
 * Returns null when outside a Practice rotation (the normal case).
 */
export function usePracticeRotation(): PracticeRotationContextValue | null {
  return useContext(PracticeRotationContext);
}
