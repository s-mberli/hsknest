"use client";

import { motion } from "framer-motion";

import { usePrefersReducedMotion } from "@/lib/motion";

const BLOBS = [
  { color: "var(--primary)", size: 420, x: "10%", y: "0%", dur: 22 },
  { color: "var(--amber)", size: 360, x: "70%", y: "20%", dur: 26 },
  { color: "var(--success)", size: 320, x: "40%", y: "60%", dur: 30 },
];

/**
 * Slow-drifting blurred radial blobs behind hero/celebration content — the
 * "Flux Field" analogue in our warm palette. Transform-only so it stays
 * GPU-cheap. Collapses to one static soft glow under reduced motion.
 */
export function AuroraGlow({ className }: { className?: string }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      {reducedMotion ? (
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            width: 420,
            height: 420,
            background: "var(--primary)",
          }}
        />
      ) : (
        BLOBS.map((blob, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-20 blur-3xl"
            style={{
              width: blob.size,
              height: blob.size,
              left: blob.x,
              top: blob.y,
              background: blob.color,
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -20, 20, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: blob.dur,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))
      )}
    </div>
  );
}
