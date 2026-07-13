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
  exitDirection: SwipeDirection | null;
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
  exitDirection,
  textSize,
  autoPlay = false,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-18, 18]);

  const knewOpacity = useTransform(x, [40, 150], [0, 1]);
  const forgotOpacity = useTransform(x, [-150, -40], [1, 0]);
  const easyOpacity = useTransform(y, [-150, -40], [1, 0]);
  const hardOpacity = useTransform(y, [40, 150], [0, 1]);

  const armed = isTop && stage === "FULL";

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

  // Direction-specific exit target.
  const exit =
    exitDirection === "right"
      ? { x: vw * 1.3, rotate: 30, opacity: 0 }
      : exitDirection === "left"
        ? { x: -vw * 1.3, rotate: -30, opacity: 0 }
        : exitDirection === "up"
          ? { y: -vh * 1.1, scale: 1.05, opacity: 0 }
          : exitDirection === "down"
            ? { y: vh * 0.5, opacity: 0 }
            : { opacity: 0 };

  return (
    <motion.div
      className="absolute inset-0"
      style={
        isTop
          ? { x, y, rotate, zIndex: 10 }
          : {
              scale: 1 - depth * 0.05,
              y: depth * 12,
              zIndex: 10 - depth,
            }
      }
      initial={isTop ? false : { scale: 1 - depth * 0.05, y: depth * 12 }}
      animate={
        isTop ? undefined : { scale: 1 - depth * 0.05, y: depth * 12 }
      }
      exit={{
        ...exit,
        transition: { type: "spring", stiffness: 200, damping: 25 },
      }}
      drag={armed}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      onTap={
        isTop && stage !== "FULL" && onAdvance ? () => onAdvance() : undefined
      }
    >
      {/* Previews aren't graded, so the grade-direction hints would mislead. */}
      {isTop && armed && !card.preview && (
        <SwipeIndicators
          forgotOpacity={forgotOpacity}
          knewOpacity={knewOpacity}
          easyOpacity={easyOpacity}
          hardOpacity={hardOpacity}
        />
      )}
      <CardFace
        card={card}
        stage={isTop ? stage : "TERM"}
        interactive={isTop}
        textSize={textSize}
        autoPlay={isTop && autoPlay}
      />
    </motion.div>
  );
}
