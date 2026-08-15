/**
 * Ink trail canvas: renders pointer trail as a tapered polyline.
 * DPR-scaled backing store, updated every RAF frame.
 * Placed after tiles in DOM so trail renders on top.
 */

import { forwardRef, useEffect, useRef } from "react";
import type { EngineState } from "@/lib/ninja/types";
import { SLICE_BURST_MS } from "@/lib/ninja/engine";

// A handful of streaks radiating from the slice point, at fixed angles so
// the burst reads as a deliberate splatter rather than random noise.
const BURST_ANGLES = [0, 51, 102, 153, 204, 255, 306] as const;

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

        // Clear canvas
        ctx.clearRect(0, 0, element.clientWidth, element.clientHeight);

        // Draw trail as tapered polyline
        if (state.trail.length > 1) {
          const trail = state.trail;

          // Draw line segments, tapering based on age
          for (let i = 1; i < trail.length; i++) {
            const p1 = trail[i - 1];
            const p2 = trail[i];

            // Taper: older points are thinner
            const ageP1 = now - p1.t;
            const ageP2 = now - p2.t;
            const maxAge = state.trailMs;

            // Width starts at 8px and tapers to 1px
            const widthP1 = Math.max(1, 8 * (1 - ageP1 / maxAge));
            const widthP2 = Math.max(1, 8 * (1 - ageP2 / maxAge));

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
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        // Ink-splatter burst on each successful slice — a handful of short
        // streaks radiating outward, growing and fading over SLICE_BURST_MS.
        for (const burst of state.sliceBursts) {
          const age = now - burst.t;
          if (age < 0 || age >= SLICE_BURST_MS) continue;
          const progress = age / SLICE_BURST_MS;
          const alpha = 1 - progress;
          const innerR = 4 + progress * 6;
          const outerR = innerR + 10 + progress * 14;

          ctx.strokeStyle = `rgba(234, 88, 12, ${alpha * 0.85})`;
          ctx.lineWidth = Math.max(1, 3 * (1 - progress));
          ctx.lineCap = "round";

          for (const deg of BURST_ANGLES) {
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
