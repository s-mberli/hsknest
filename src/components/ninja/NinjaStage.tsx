/**
 * Ninja game stage: container with HUD, prompt, tiles, and ink canvas.
 * Receives view from useNinjaEngine, renders tiles as DOM, canvas for ink trail.
 */

"use client";

import { useRef, useEffect } from "react";
import { Check, X, ArrowDown } from "lucide-react";
import type { NinjaView } from "@/hooks/useNinjaEngine";
import type { EngineState } from "@/lib/ninja/types";
import { playSlice, playSliceWrong, playMiss, setSoundEnabled } from "@/lib/sound";
import NinjaTile from "./NinjaTile";
import InkCanvas from "./InkCanvas";

export interface NinjaStageProps {
  view: NinjaView;
  stageRef: React.RefObject<HTMLDivElement | null>;
  tileElRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  stateRef: React.MutableRefObject<EngineState>;
  onTileFaded?: (tileId: string) => void;
}

export default function NinjaStage({
  view,
  stageRef,
  tileElRefs,
  stateRef,
  onTileFaded,
}: NinjaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // This test/prototype route has no user settings to read soundEffects from —
  // default sound on. NinjaScreen (Phase 5, real app wiring) must call
  // setSoundEnabled(user.soundEffects) instead, same gotcha StudyScreen hit.
  useEffect(() => {
    setSoundEnabled(true);
  }, []);

  // Play a synthesised cue exactly once per resolved wave. lastOutcome is a
  // fresh object identity each time a wave resolves (see useNinjaEngine), so
  // this effect fires once per outcome, not once per unrelated re-render.
  useEffect(() => {
    if (!view.lastOutcome) return;
    if (view.lastOutcome.kind === "correct") playSlice(view.combo);
    else if (view.lastOutcome.kind === "wrong") playSliceWrong();
    else playMiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.lastOutcome]);

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
        <InkCanvas ref={canvasRef} stateRef={stateRef} />

        {/* Corrective feedback: shown for the ~900ms inter-wave pause after a
            wave resolves. Never color-only — icon + text + color together,
            per the accessibility bar for this mode. */}
        {view.waveStatus === "resolved" && view.lastOutcome && (
          <div
            className="absolute inset-x-0 top-4 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md"
            style={
              view.lastOutcome.kind === "correct"
                ? { background: "var(--success)", color: "var(--success-foreground)" }
                : { background: "var(--destructive)", color: "var(--destructive-foreground)" }
            }
            role="status"
            aria-live="polite"
          >
            {view.lastOutcome.kind === "correct" && (
              <>
                <Check className="size-4 shrink-0" aria-hidden="true" />
                <span>Correct — {view.lastOutcome.char} ({view.lastOutcome.translation})</span>
              </>
            )}
            {view.lastOutcome.kind === "wrong" && (
              <>
                <X className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  Wrong tile — {view.lastOutcome.translation} was {view.lastOutcome.char}
                </span>
              </>
            )}
            {view.lastOutcome.kind === "missed" && (
              <>
                <ArrowDown className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  Missed — {view.lastOutcome.translation} was {view.lastOutcome.char}
                </span>
              </>
            )}
          </div>
        )}

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
