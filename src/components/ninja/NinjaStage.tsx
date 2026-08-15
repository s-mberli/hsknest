/**
 * Ninja game stage: container with HUD, prompt, tiles, and ink canvas.
 * Receives view from useNinjaEngine, renders tiles as DOM, canvas for ink trail.
 */

"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Check, X as XIcon, ArrowDown, Heart, Flame, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NinjaView } from "@/hooks/useNinjaEngine";
import type { EngineState } from "@/lib/ninja/types";
import { playSliceWrong, playMiss, setSoundEnabled } from "@/lib/sound";
import { playAudio } from "@/lib/audio";
import { WAVES_PER_SESSION } from "@/lib/ninja/scoring";
import NinjaTile from "./NinjaTile";
import InkCanvas from "./InkCanvas";

const TOTAL_WAVES = WAVES_PER_SESSION;
const TOTAL_LIVES = 3;

export interface NinjaStageProps {
  view: NinjaView;
  stageRef: React.RefObject<HTMLDivElement | null>;
  tileElRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  stateRef: React.MutableRefObject<EngineState>;
  onTileFaded?: (tileId: string) => void;
  /** BCP-47ish language code for pronunciation audio, e.g. "zh". Defaults to
   * "zh" for the throwaway test route; NinjaScreen (Phase 5) must pass the
   * word's real Language.code instead. */
  langCode?: string;
  /** Where the exit (X) button in the HUD goes. Defaults to /dashboard —
   * the throwaway test route has no shell to return to, but a dead link is
   * worse than pointing at the real app entry. */
  exitHref?: string;
}

export default function NinjaStage({
  view,
  stageRef,
  tileElRefs,
  stateRef,
  onTileFaded,
  langCode = "zh",
  exitHref = "/dashboard",
}: NinjaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // This test/prototype route has no user settings to read soundEffects from —
  // default sound on. NinjaScreen (Phase 5, real app wiring) must call
  // setSoundEnabled(user.soundEffects) instead, same gotcha StudyScreen hit.
  useEffect(() => {
    setSoundEnabled(true);
  }, []);

  // Feedback per resolved wave. lastOutcome is a fresh object identity each
  // time a wave resolves (see useNinjaEngine), so this effect fires once per
  // outcome, not once per unrelated re-render.
  //
  // Correct: play the real pronunciation clip (playAudio) as confirmation —
  // strictly better than a synthesised blip, and we already have it for 11K
  // words. Wrong/missed: keep a short synthesised cue for the *immediate*
  // signal (audio playback has latency), then also play the target's real
  // pronunciation so the correct answer is heard, not just read — mirrors the
  // "retrieve first, then confirm" flow from MatchScreen.
  useEffect(() => {
    if (!view.lastOutcome) return;
    const { kind, char } = view.lastOutcome;
    if (kind === "correct") {
      void playAudio(char, "word", langCode);
    } else {
      if (kind === "wrong") playSliceWrong();
      else playMiss();
      void playAudio(char, "word", langCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.lastOutcome]);

  // "Listen & Slice" waves lead with audio instead of a gloss. Fire it once
  // per new prompt, right when the wave spawns (still lead-in, tiles static
  // — see useNinjaEngine) rather than waiting for "live", so the full
  // lead-in doubles as listening time. promptWord is a fresh object each
  // spawn (see engine.ts), so this effect fires once per wave, not once per
  // unrelated re-render. Guard the empty initial-state prompt.
  useEffect(() => {
    if (!view.promptWord.isAudioPrompt || !view.promptWord.char) return;
    void playAudio(view.promptWord.char, "word", langCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.promptWord]);

  const wavePct = Math.min(100, (view.waveIndex / TOTAL_WAVES) * 100);
  const livesLeft = Math.max(view.lives, 0);
  // Background warms toward amber as combo climbs, capped well below full
  // saturation so it stays a mood cue, not a color swap. Resets with combo
  // (state.combo already zeroes on miss/wrong — see engine.ts).
  const comboWarmth = Math.min(view.combo, 8) / 8;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ background: "var(--secondary)", opacity: comboWarmth * 0.12 }}
        aria-hidden="true"
      />

      {/* Session progress — waves cleared, not time. Matches SessionHud's
          thin vermilion bar so the mode still feels like part of the app. */}
      <div className="h-0.5 w-full shrink-0 bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${wavePct}%` }}
        />
      </div>

      {/* HUD — no exit button here: it looked clickable but the game never
          wired an exit-mid-session flow, and a button that appears to do
          nothing is worse than no button. Exit lives on the game-over screen
          instead, where it actually does something. */}
      <header className="grid shrink-0 grid-cols-3 items-center px-3 py-2 sm:px-6 sm:py-3">
        <div
          className="flex items-center gap-0.5 justify-self-start"
          role="status"
          aria-label={`${livesLeft} of ${TOTAL_LIVES} lives left`}
        >
          {Array.from({ length: TOTAL_LIVES }).map((_, i) => (
            <Heart
              key={i}
              aria-hidden="true"
              className={
                i < livesLeft
                  ? "size-4 fill-destructive text-destructive sm:size-5"
                  : "size-4 text-muted-foreground/25 sm:size-5"
              }
            />
          ))}
        </div>

        <span className="justify-self-center text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
          Wave {Math.min(view.waveIndex + 1, TOTAL_WAVES)}/{TOTAL_WAVES}
        </span>

        <div className="flex items-center justify-self-end gap-1 text-sm font-semibold text-primary">
          {view.combo >= 2 && (
            <>
              <Flame className="size-4" aria-hidden="true" />
              <span aria-label={`Combo ${view.combo}`}>{view.combo}</span>
            </>
          )}
        </div>
      </header>

      {/* Prompt card doubles as the feedback banner. It used to be a small
          popup floating over the stage — the hanzi in it was tiny and
          unreadable, and it competed for attention with the tiles. Now the
          card itself flips color and shows the answer at prompt-sized text,
          in the one place your eyes are already resting between waves. A
          fixed min-height keeps the card the same size in both states so it
          doesn't resize the stage under falling tiles (see stageBounds). */}
      <div
        className="mx-3 mb-3 flex min-h-[112px] shrink-0 flex-col items-center justify-center rounded-2xl px-5 py-4 text-center shadow-sm transition-colors duration-200 sm:mx-6 sm:min-h-[132px] sm:px-6 sm:py-5"
        style={
          view.waveStatus === "resolved" && view.lastOutcome
            ? view.lastOutcome.kind === "correct"
              ? { background: "var(--success)", color: "var(--success-foreground)" }
              : { background: "var(--destructive)", color: "var(--destructive-foreground)" }
            : undefined
        }
        role="status"
        aria-live="polite"
      >
        {view.waveStatus === "resolved" && view.lastOutcome ? (
          <div
            key={`${view.waveIndex}-${view.lastOutcome.kind}`}
            className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-0.5 duration-200"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
              {view.lastOutcome.kind === "correct" && (
                <>
                  <Check className="size-3.5" aria-hidden="true" /> Correct
                </>
              )}
              {view.lastOutcome.kind === "wrong" && (
                <>
                  <XIcon className="size-3.5" aria-hidden="true" /> Wrong tile — it was
                </>
              )}
              {view.lastOutcome.kind === "missed" && (
                <>
                  <ArrowDown className="size-3.5" aria-hidden="true" /> Missed — it was
                </>
              )}
            </p>
            <p className="text-5xl font-bold font-serif leading-tight sm:text-6xl">
              {view.lastOutcome.char}
            </p>
            <p className="text-sm font-medium opacity-90">{view.lastOutcome.translation}</p>
          </div>
        ) : view.promptWord.isAudioPrompt ? (
          <button
            key={`${view.waveIndex}-${view.promptWord.wordId}`}
            type="button"
            className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-1 rounded-xl duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => void playAudio(view.promptWord.char, "word", langCode)}
            aria-label="Replay pronunciation"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Slice the word you hear
            </p>
            <Volume2 className="size-8 text-primary sm:size-9" aria-hidden="true" />
            <span className="text-[11px] font-medium text-muted-foreground">Tap to replay</span>
          </button>
        ) : (
          <div
            key={`${view.waveIndex}-${view.promptWord.wordId}`}
            className="animate-in fade-in zoom-in-95 duration-200"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Slice the word for
            </p>
            <p className="mt-0.5 text-3xl font-bold font-serif leading-tight sm:text-4xl">
              {view.promptWord.translation}
            </p>
          </div>
        )}
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden"
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

        {view.waveStatus === "game-over" && (
          <div className="animate-in fade-in absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background/95 px-6 text-center backdrop-blur-sm duration-300">
            <div className="space-y-1">
              <p className="text-2xl font-bold font-serif sm:text-3xl">
                {view.correct}/{TOTAL_WAVES} correct
              </p>
              <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <Flame className="size-4 text-primary" aria-hidden="true" />
                Best combo: {view.bestCombo}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline">
                <Link href={exitHref}>Exit</Link>
              </Button>
              <Button onClick={() => window.location.reload()}>Play Again</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
