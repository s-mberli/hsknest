"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` setting reactively.
 *
 * CSS handles most animation opt-out, but canvas/RAF effects (confetti) and
 * JS-driven framer-motion loops (aurora drift) can't be disabled by CSS — they
 * branch on this hook instead. Defaults to `false` on the server so the first
 * client render matches, then syncs on mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
