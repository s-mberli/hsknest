/**
 * Ninja game stage: container with HUD, prompt, tiles, and ink canvas.
 * Receives view from useNinjaEngine, renders tiles as DOM, canvas for ink trail.
 */

"use client";

import { useRef, useEffect } from "react";
import type { NinjaView } from "@/hooks/useNinjaEngine";
import NinjaTile from "./NinjaTile";
import InkCanvas from "./InkCanvas";

export interface NinjaStageProps {
  view: NinjaView;
  stageRef: React.RefObject<HTMLDivElement | null>;
  tileElRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onTileFaded?: (tileId: string) => void;
}

export default function NinjaStage({
  view,
  stageRef,
  tileElRefs,
  onTileFaded,
}: NinjaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-2 text-sm font-medium">
        <span>Lives: {"❤️".repeat(Math.max(view.lives, 0))}</span>
        <span>Wave {Math.min(view.waveIndex + 1, 12)}/12</span>
        <span>Combo {view.combo} (best {view.bestCombo})</span>
      </div>

      {/* Prompt card */}
      <div className="mx-4 mb-3 rounded-lg border-2 border-foreground/30 bg-foreground/5 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-wide text-foreground/50">Slice the word for</p>
        <p className="text-3xl font-bold font-serif leading-tight">
          {view.promptWord.translation}
        </p>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
      >
        {view.tiles.map((tile) => (
          <NinjaTile
            key={tile.id}
            tile={tile}
            tileElRefs={tileElRefs}
            onFaded={onTileFaded}
          />
        ))}

        {/* Ink canvas renders last so trail is on top */}
        <InkCanvas ref={canvasRef} />

        {view.waveStatus === "game-over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
            <p className="text-xl font-serif">
              {view.correct}/12 correct
            </p>
            <p className="text-sm">Best combo: {view.bestCombo}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/10"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
