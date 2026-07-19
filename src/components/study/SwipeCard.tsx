"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";

import { CardFace } from "@/components/study/CardFace";
import { SwipeIndicators } from "@/components/study/SwipeIndicators";
import type { Stage, StudyCard, SwipeDirection } from "@/hooks/useStudySession";
import type { CardTextSize } from "@/lib/textSize";

interface SwipeCardProps {
  card: StudyCard;
  stage: Stage;
  onSwipe: (direction: SwipeDirection) => void;
  /** Advance the reveal stage on tap (top card, pre-FULL only). */
  onAdvance?: () => void;
  /** Depth offset for stacked cards behind the top card. */
  depth: number;
  isTop: boolean;
  /**
   * Non-null → this is a committed card flying off screen. The parent keeps
   * it mounted briefly and animates it out here (deliberately NOT
   * AnimatePresence: its exit tracking silently breaks under the current
   * React/framer pairing, leaving dismissed cards frozen on screen).
   */
  flyOut?: SwipeDirection | null;
  textSize: CardTextSize;
  /** Speak the term automatically when its reading is revealed (top card). */
  autoPlay?: boolean;
}

const COMMIT_OFFSET = 120;
const COMMIT_VELOCITY = 600;

export function SwipeCard({
  card,
  stage,
  onSwipe,
  onAdvance,
  depth,
  isTop,
  flyOut = null,
  textSize,
  autoPlay = false,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-18, 18]);

  const knewOpacity = useTransform(x, [15, 90], [0, 1]);
  const forgotOpacity = useTransform(x, [-90, -15], [1, 0]);
  const easyOpacity = useTransform(y, [-90, -15], [1, 0]);
  const hardOpacity = useTransform(y, [15, 90], [0, 1]);

  // Card-wide color wash while dragging, so the grade color reads well
  // before the commit threshold (user-test feedback: colors came too late).
  const knewTint = useTransform(x, [15, 110], [0, 0.16]);
  const forgotTint = useTransform(x, [-110, -15], [0.16, 0]);
  const easyTint = useTransform(y, [-110, -15], [0.16, 0]);
  const hardTint = useTransform(y, [15, 110], [0, 0.16]);

  const armed = isTop && stage === "FULL" && !flyOut;

  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    const horiz =
      Math.abs(offset.x) > COMMIT_OFFSET ||
      Math.abs(velocity.x) > COMMIT_VELOCITY;
    const vert =
      Math.abs(offset.y) > COMMIT_OFFSET ||
      Math.abs(velocity.y) > COMMIT_VELOCITY;
    if (!horiz && !vert) return; // springs back

    // Dominant-axis resolution.
    if (Math.abs(offset.x) >= Math.abs(offset.y)) {
      onSwipe(offset.x > 0 ? "right" : "left");
    } else {
      onSwipe(offset.y > 0 ? "down" : "up");
    }
  }

  // Direction-specific fly-off target.
  const flyTarget =
    flyOut === "right"
      ? { x: vw * 1.3, rotate: 30, opacity: 0 }
      : flyOut === "left"
        ? { x: -vw * 1.3, rotate: -30, opacity: 0 }
        : flyOut === "up"
          ? { y: -vh * 1.1, scale: 1.05, opacity: 0 }
          : flyOut === "down"
            ? { y: vh * 0.5, opacity: 0 }
            : undefined;

  return (
    <motion.div
      className="absolute inset-0"
      style={
        flyOut
          ? { x, y, rotate, zIndex: 20, pointerEvents: "none" }
          : isTop
            ? { x, y, rotate, zIndex: 10 }
            : {
                scale: 1 - depth * 0.05,
                y: depth * 12,
                zIndex: 10 - depth,
              }
      }
      initial={isTop || flyOut ? false : { scale: 1 - depth * 0.05, y: depth * 12 }}
      animate={
        flyTarget ??
        (isTop ? undefined : { scale: 1 - depth * 0.05, y: depth * 12 })
      }
      transition={
        flyTarget
          ? { type: "spring", stiffness: 200, damping: 25 }
          : undefined
      }
      drag={armed}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      onTap={
        isTop && !flyOut && stage !== "FULL" && onAdvance
          ? () => onAdvance()
          : undefined
      }
    >
      {/* Previews aren't graded, so the grade-direction hints would mislead. */}
      {armed && !card.preview && (
        <>
          <motion.div
            style={{ opacity: knewTint }}
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-success"
          />
          <motion.div
            style={{ opacity: forgotTint }}
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-destructive"
          />
          <motion.div
            style={{ opacity: easyTint }}
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-success"
          />
          <motion.div
            style={{ opacity: hardTint }}
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-amber"
          />
        </>
      )}
      {armed && !card.preview && (
        <SwipeIndicators
          forgotOpacity={forgotOpacity}
          knewOpacity={knewOpacity}
          easyOpacity={easyOpacity}
          hardOpacity={hardOpacity}
        />
      )}
      <CardFace
        card={card}
        stage={isTop || flyOut ? stage : "TERM"}
        // Flying cards keep the interactive layout so nothing reflows
        // mid-flight; pointer events are already off on the wrapper.
        interactive={isTop || !!flyOut}
        textSize={textSize}
        autoPlay={isTop && !flyOut && autoPlay}
      />
    </motion.div>
  );
}
