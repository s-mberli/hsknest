/**
 * Single tile: circular backdrop + hanzi character.
 * Position managed by useNinjaEngine.paint() per-frame.
 * Opacity managed here to fade out when sliced.
 */

import { forwardRef, useEffect } from "react";

interface TileData {
  id: string;
  char: string;
  position: { x: number; y: number };
  sliced: boolean;
}

export interface NinjaTileProps {
  tile: TileData;
  tileElRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onFaded?: (tileId: string) => void;
}

const NinjaTile = forwardRef<HTMLDivElement, NinjaTileProps>(
  ({ tile, tileElRefs, onFaded }, ref) => {
    // Handle sliced state (fade out and callback)
    useEffect(() => {
      const el = tileElRefs.current.get(tile.id);
      if (!el) return;

      if (tile.sliced) {
        el.style.opacity = "0";
        const timer = setTimeout(() => {
          onFaded?.(tile.id);
        }, 300);
        return () => clearTimeout(timer);
      }

      el.style.opacity = "1";
    }, [tile.sliced, tile.id, tileElRefs, onFaded]);

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
        className="absolute left-0 top-0 flex select-none items-center justify-center rounded-full border-2 border-border bg-card shadow-md transition-opacity duration-300"
        style={{
          width: "clamp(79.2px, 14.4vw, 129.6px)", // 1.8 * clamp(44px, 8vw, 72px)
          aspectRatio: "1 / 1",
          pointerEvents: "none",
          willChange: "transform, opacity",
        }}
      >
        <span
          className="font-serif"
          style={{
            fontSize: "clamp(44px, 8vw, 72px)",
          }}
        >
          {tile.char}
        </span>
      </div>
    );
  }
);

NinjaTile.displayName = "NinjaTile";

export default NinjaTile;
