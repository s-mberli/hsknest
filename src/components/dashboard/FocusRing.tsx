"use client";

import { motion } from "framer-motion";

interface FocusRingProps {
  due: number; // vermilion
  checks: number; // amber
  fresh: number; // ink gray
}

const SIZE = 240;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const GAP = 0.015; // fraction of the ring left blank between segments

/**
 * Large SVG focus ring. Segments show today's session composition:
 * due (vermilion), assumed checks (amber), new (ink gray).
 * Empty state = faint full ring. Children render in the center.
 *
 * Uses pathLength=1 so dash values are fractions of the whole circle.
 */
export function FocusRing({
  due,
  checks,
  fresh,
  children,
}: FocusRingProps & { children?: React.ReactNode }) {
  const total = due + checks + fresh;

  const raw = [
    { color: "var(--primary)", value: due },
    { color: "var(--amber)", value: checks },
    { color: "var(--muted-foreground)", value: fresh },
  ].filter((s) => s.value > 0);

  const gapTotal = raw.length > 1 ? GAP * raw.length : 0;
  const usable = 1 - gapTotal;

  let cursor = 0;
  const segments = raw.map((s) => {
    const len = total > 0 ? (s.value / total) * usable : 0;
    const seg = { color: s.color, len, start: cursor };
    cursor += len + (raw.length > 1 ? GAP : 0);
    return seg;
  });

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
      >
        {/* Base faint ring (also the empty-state ring). */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        {segments.map((s, i) => (
          <motion.circle
            key={i}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={s.len}
            strokeDashoffset={-s.start}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: s.len }}
            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.12 }}
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
        {children}
      </div>
    </div>
  );
}
