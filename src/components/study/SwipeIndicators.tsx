"use client";

import { motion, type MotionValue } from "framer-motion";

interface SwipeIndicatorsProps {
  forgotOpacity: MotionValue<number>; // ← left
  knewOpacity: MotionValue<number>; // → right
  easyOpacity: MotionValue<number>; // ↑ up
  hardOpacity: MotionValue<number>; // ↓ down
}

const pill =
  "pointer-events-none absolute z-20 rounded-full border-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide";

/** Four directional grade pills; opacity driven by drag on both axes. */
export function SwipeIndicators({
  forgotOpacity,
  knewOpacity,
  easyOpacity,
  hardOpacity,
}: SwipeIndicatorsProps) {
  return (
    <>
      <motion.div
        style={{ opacity: forgotOpacity }}
        className={`${pill} left-5 top-1/2 -translate-y-1/2 border-destructive text-destructive`}
      >
        Forgot
      </motion.div>
      <motion.div
        style={{ opacity: knewOpacity }}
        className={`${pill} right-5 top-1/2 -translate-y-1/2 border-success text-success`}
      >
        Knew
      </motion.div>
      <motion.div
        style={{ opacity: easyOpacity }}
        className={`${pill} left-1/2 top-5 -translate-x-1/2 border-success text-success`}
      >
        Easy
      </motion.div>
      <motion.div
        style={{ opacity: hardOpacity }}
        className={`${pill} bottom-5 left-1/2 -translate-x-1/2 border-amber text-amber`}
      >
        Hard
      </motion.div>
    </>
  );
}
