/**
 * Single tile: circular backdrop + hanzi character (or English translation text).
 * Position managed by useNinjaEngine.paint() per-frame.
 * On slice, splits into two halves that fly apart (clip-path + transform)
 * instead of just fading — the money-shot visual for a Reddit GIF.
 */

import { forwardRef, useEffect, useMemo } from "react";

interface TileData {
  id: string;
  char: string;
  position: { x: number; y: number };
  sliced: boolean;
  /** Font size in px, derived from the tile's real circle diameter and the
   * wave's longest term (see waveFontSize in engine.ts) — uniform across the
   * whole wave. Falls back to a readable default for callers that don't pass
   * it (e.g. any stale test fixture). */
  fontSize?: number;
}

/** CSSProperties plus the three custom properties .ninja-tile-half's
 * keyframe (globals.css) reads. React's CSSProperties type doesn't model
 * arbitrary custom properties, so a narrow extension replaces `as any`. */
type FlingHalfStyle = React.CSSProperties & {
  "--fling-x": string;
  "--fling-y": string;
  "--fling-r": string;
};

export interface NinjaTileProps {
  tile: TileData;
  tileElRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

/** Deterministic 0..1 hash off the tile id, used to vary slice angle and
 * fling direction per tile without needing extra state. */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

const NinjaTile = forwardRef<HTMLDivElement, NinjaTileProps>(
  ({ tile, tileElRefs }, ref) => {
    useEffect(() => {
      const el = tileElRefs.current.get(tile.id);
      if (!el) return;

      if (!tile.sliced) {
        el.style.opacity = "1";
      }
      // Sliced tiles are retained (unconditionally, by stepPhysics) until the
      // next launchWaveTiles clears them — no per-tile fade-complete callback
      // needed; the .ninja-tile-half fling animation in globals.css handles
      // its own visual cleanup independently.
    }, [tile.sliced, tile.id, tileElRefs]);

    // Slice angle varies per tile (deterministic from id) so a wave of
    // simultaneous slices doesn't all split the same way.
    const angle = useMemo(() => -30 + hash01(tile.id) * 60, [tile.id]);
    const flingSign = useMemo(() => (hash01(tile.id + "f") > 0.5 ? 1 : -1), [tile.id]);
    const fontSize = tile.fontSize ?? 32;

    return (
      <div
        ref={(el) => {
          if (el) {
            tileElRefs.current.set(tile.id, el);
            if (ref && typeof ref === "object") {
              ref.current = el;
            }
          } else {
            tileElRefs.current.delete(tile.id);
          }
        }}
        className="absolute left-0 top-0 select-none"
        style={{
          width: "clamp(79.2px, 14.4vw, 129.6px)", // 1.8 * clamp(44px, 8vw, 72px)
          aspectRatio: "1 / 1",
          pointerEvents: "none",
          willChange: "transform, opacity",
        }}
      >
        {tile.sliced ? (
          <>
            {/* Red impact glow, sitting behind both halves and NOT clipped
                to either one. Putting this glow on the halves themselves
                (e.g. a box-shadow) gets chopped along the same straight
                clip-path edge that makes the semicircle — it reads as a
                lopsided smear instead of a clean flash. A separate,
                unclipped circle avoids that entirely. */}
            <div
              className="ninja-slice-glow pointer-events-none absolute inset-0 z-10 rounded-full"
              aria-hidden="true"
            />
            {/* Bright white slice-line flashed once across the cut angle —
                the "blade connected" beat that a fling alone reads as too
                subtle to notice. Sits above both halves, fades out fast. */}
            <div
              className="ninja-slice-flash pointer-events-none absolute left-1/2 top-1/2 z-30 h-[3px] w-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                boxShadow: "0 0 12px 3px rgba(255,255,255,0.9)",
              }}
            />
            {/* Two halves of the same circle, clipped along `angle` and
                flung apart in opposite directions — big separation plus a
                gravity-driven fall (see .ninja-tile-half in globals.css) so
                the cut is unmissable, not just a barely-visible fade.
                Rendered as siblings, not a rotation of one div, so each half
                keeps its own straight clip edge regardless of slice angle. */}
            <div
              className="absolute inset-0"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <div
                className="ninja-tile-half absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card shadow-md"
                style={
                  {
                    clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)",
                    "--fling-x": `${-flingSign * 130}px`,
                    "--fling-y": "-110px",
                    "--fling-r": `${-flingSign * 100}deg`,
                  } as FlingHalfStyle
                }
              >
                <span
                  data-term
                  className="whitespace-nowrap px-1.5 text-center leading-tight"
                  style={{ fontSize, transform: `rotate(${-angle}deg)` }}
                >
                  {tile.char}
                </span>
              </div>
              <div
                className="ninja-tile-half absolute inset-0 overflow-hidden rounded-full border-2 border-border bg-card shadow-md"
                style={
                  {
                    clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)",
                    "--fling-x": `${flingSign * 130}px`,
                    "--fling-y": "110px",
                    "--fling-r": `${flingSign * 100}deg`,
                  } as FlingHalfStyle
                }
              />
            </div>
          </>
        ) : (
          <div
            className="flex h-full w-full select-none items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card shadow-md transition-opacity duration-300"
          >
            {/* data-term, no hardcoded font-serif: same [data-character-style]
                [data-term] selector (globals.css) that CardFace.tsx uses, so
                tiles follow the user's academic/modern character-style
                setting instead of always forcing serif. fontSize is uniform
                across the wave (see launchWaveTiles in engine.ts), not
                recomputed per-tile — mixed sizes in one wave read as broken. */}
            <span
              data-term
              className="whitespace-nowrap px-1.5 text-center leading-tight"
              style={{ fontSize }}
            >
              {tile.char}
            </span>
          </div>
        )}
      </div>
    );
  }
);

NinjaTile.displayName = "NinjaTile";

export default NinjaTile;
