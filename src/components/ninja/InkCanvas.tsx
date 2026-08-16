/**
 * Ink trail canvas: renders pointer trail as a tapered polyline.
 * DPR-scaled backing store, updated every RAF frame.
 * Placed after tiles in DOM so trail renders on top.
 */

import { forwardRef, useEffect, useRef } from "react";
import type { EngineState } from "@/lib/ninja/types";
import { SLICE_BURST_MS } from "@/lib/ninja/engine";

// A handful of streaks radiating from the slice point. Base angles keep the
// burst evenly spread (not clumped); a small deterministic-per-burst jitter
// on top makes each splatter read as organic ink rather than a symmetric
// sunburst icon.
const BURST_BASE_ANGLES = [0, 51, 102, 153, 204, 255, 306] as const;

function jitterAngles(seed: number): number[] {
  return BURST_BASE_ANGLES.map((deg, i) => {
    const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const jitter = (n - Math.floor(n)) * 26 - 13; // ±13°
    return deg + jitter;
  });
}

export interface InkCanvasProps {
  stateRef: React.MutableRefObject<EngineState>;
}

const InkCanvas = forwardRef<HTMLCanvasElement, InkCanvasProps>(
  ({ stateRef }, ref) => {
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
      const element = (ref as React.MutableRefObject<HTMLCanvasElement | null>)?.current;
      if (!element) return;

      const ctx = element.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      let lastCssWidth = -1;
      let lastCssHeight = -1;

      // Set canvas backing-store size based on the CSS box (clientWidth/Height).
      // IMPORTANT: observe the parent, not this canvas — writing element.width/height
      // on the canvas itself would otherwise re-trigger a ResizeObserver watching the
      // canvas, compounding into a runaway feedback loop (each write grows the box).
      const resize = () => {
        const cssWidth = element.clientWidth;
        const cssHeight = element.clientHeight;
        if (cssWidth === lastCssWidth && cssHeight === lastCssHeight) return;
        lastCssWidth = cssWidth;
        lastCssHeight = cssHeight;
        element.width = cssWidth * dpr;
        element.height = cssHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();

      // Observe the parent (stage) so canvas attribute writes can't feed back into
      // the observer that triggered them.
      const observedEl = element.parentElement ?? element;
      const observer = new ResizeObserver(() => {
        resize();
      });
      observer.observe(observedEl);

      const tick = () => {
        const state = stateRef.current;
        const now = performance.now();

        // Game-over + nothing left to draw: the engine's own RAF loop stops
        // simulating at this point (see useNinjaEngine.ts), and Play Again is
        // a full page reload, so there is nothing that will ever populate the
        // trail/bursts again this mount. Stop polling instead of clearing an
        // already-blank canvas 60x/sec forever on the game-over screen.
        if (
          state.waveStatus === "game-over" &&
          state.trail.length === 0 &&
          state.sliceBursts.length === 0
        ) {
          return;
        }

        // Clear canvas
        ctx.clearRect(0, 0, element.clientWidth, element.clientHeight);

        // Draw trail as a tapered, smoothed stroke
        if (state.trail.length > 1) {
          const trail = state.trail;

          // Raw point-to-point lineTo segments read as jagged/stair-stepped
          // at typical pointermove sampling rates — each segment is its own
          // straight line with a hard seam at the joint. Smooth by curving
          // through the midpoint of each consecutive pair (a standard
          // freehand-drawing technique): quadraticCurveTo bows the segment
          // toward the real point p2 while landing on midpoints, which
          // rounds out the seams instead of leaving visible corners.
          for (let i = 1; i < trail.length; i++) {
            const p1 = trail[i - 1];
            const p2 = trail[i];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const prevMidX = i > 1 ? (trail[i - 2].x + p1.x) / 2 : p1.x;
            const prevMidY = i > 1 ? (trail[i - 2].y + p1.y) / 2 : p1.y;

            // Taper: older points are thinner
            const ageP1 = now - p1.t;
            const ageP2 = now - p2.t;
            const maxAge = state.trailMs;

            const segDt = Math.max(1, p2.t - p1.t);
            const segSpeed = Math.hypot(p2.x - p1.x, p2.y - p1.y) / (segDt / 1000);
            // Normalize against a "brisk slice" reference speed; clamp so a
            // very fast flick doesn't blow the stroke out past readability.
            const speedScale = Math.min(1.6, Math.max(0.6, segSpeed / 900));

            // Width starts at 8px * speedScale and tapers to 1px
            const widthP1 = Math.max(1, 8 * speedScale * (1 - ageP1 / maxAge));
            const widthP2 = Math.max(1, 8 * speedScale * (1 - ageP2 / maxAge));

            // Opacity also fades
            const alphaP1 = Math.max(0, 1 - ageP1 / maxAge);
            const alphaP2 = Math.max(0, 1 - ageP2 / maxAge);

            // Draw segment with average width/alpha
            const avgWidth = (widthP1 + widthP2) / 2;
            const avgAlpha = (alphaP1 + alphaP2) / 2;

            ctx.strokeStyle = `rgba(0, 0, 0, ${avgAlpha * 0.7})`;
            ctx.lineWidth = avgWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            ctx.moveTo(prevMidX, prevMidY);
            ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
            ctx.stroke();
          }
        }

        // Ink-splatter burst on each successful slice — a handful of short
        // streaks radiating outward, growing and fading over SLICE_BURST_MS.
        // Speed-tiered: faster slices (quality 5) get bigger/brighter bursts.
        for (const burst of state.sliceBursts) {
          const age = now - burst.t;
          if (age < 0 || age >= SLICE_BURST_MS) continue;
          const progress = age / SLICE_BURST_MS;

          // Scale burst size and brightness by quality tier
          // quality 5 (fast): 1.2x size, full alpha
          // quality 4 (medium): 1.0x size, 0.9x alpha
          // quality 3 (slow): 0.8x size, 0.75x alpha
          const qualityScale =
            burst.quality === 5 ? 1.2 : burst.quality === 4 ? 1.0 : burst.quality === 3 ? 0.8 : 1.0;
          const qualityAlpha =
            burst.quality === 5 ? 1.0 : burst.quality === 4 ? 0.9 : burst.quality === 3 ? 0.75 : 0.85;

          const alpha = (1 - progress) * qualityAlpha;
          const innerR = (4 + progress * 6) * qualityScale;
          const outerR = (innerR + 10 + progress * 14) * qualityScale;

          ctx.strokeStyle = `rgba(234, 88, 12, ${alpha * 0.85})`;
          ctx.lineWidth = Math.max(1, 3 * (1 - progress) * qualityScale);
          ctx.lineCap = "round";

          // Seed jitter off the burst's own timestamp so repeated bursts at
          // the same spot (a fast combo) still look distinct from each other.
          for (const deg of jitterAngles(burst.t)) {
            const rad = (deg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            ctx.beginPath();
            ctx.moveTo(burst.x + cos * innerR, burst.y + sin * innerR);
            ctx.lineTo(burst.x + cos * outerR, burst.y + sin * outerR);
            ctx.stroke();
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        observer.disconnect();
      };
    }, [ref]);

    return (
      <canvas
        ref={ref}
        className="absolute inset-0 pointer-events-none"
        style={{
          touchAction: "none",
          width: "100%",
          height: "100%",
        }}
      />
    );
  }
);

InkCanvas.displayName = "InkCanvas";

export default InkCanvas;
