/**
 * Canvas overlay for ink brush trail and slice particles.
 * Reads pointer trail and particle state from engine; paints each frame.
 * Modelled on ConfettiCannon (src/components/fx/ConfettiCannon.tsx).
 */

import { forwardRef, useEffect } from "react";

const InkCanvas = forwardRef<HTMLCanvasElement>((_props, ref) => {
  useEffect(() => {
    if (typeof ref === "function" || !ref?.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize canvas size (will be set by engine)
    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [ref]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
});

InkCanvas.displayName = "InkCanvas";

export default InkCanvas;
