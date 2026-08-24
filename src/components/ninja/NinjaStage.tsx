/**
 * Ninja game stage: container with HUD, prompt, tiles, and ink canvas.
 * Receives view from useNinjaEngine, renders tiles as DOM, canvas for ink trail.
 */

"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X as XIcon, ArrowDown, Heart, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NinjaView } from "@/hooks/useNinjaEngine";
import type { EngineState } from "@/lib/ninja/types";
import { playSliceWrong, playCelebrate } from "@/lib/sound";
import { playAudio } from "@/lib/audio";
import { gameGloss } from "@/lib/meanings";
import { TOTAL_LIVES } from "@/lib/ninja/scoring";
import { ConfettiCannon } from "@/components/fx/ConfettiCannon";
import NinjaTile from "./NinjaTile";
import InkCanvas from "./InkCanvas";

export interface NinjaStageProps {
  view: NinjaView;
  stageRef: React.RefObject<HTMLDivElement | null>;
  tileElRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  stateRef: React.MutableRefObject<EngineState>;
  /** BCP-47ish language code for pronunciation audio, e.g. "zh". Defaults to
   * "zh" for the throwaway test route; NinjaScreen (Phase 5) must pass the
   * word's real Language.code instead. */
  langCode?: string;
  /** Where the exit (X) button in the HUD goes. Defaults to /dashboard —
   * the throwaway test route has no shell to return to, but a dead link is
   * worse than pointing at the real app entry. */
  exitHref?: string;
  /** "dark" (Dark focus, the default) keeps the stage dark regardless of the
   * user's app theme; "follow" makes it track the app theme via CSS vars, so
   * a light app theme + Ninja no longer means a bright stage inverted
   * against dark tiles/UI. See docs/CONFIGURATION.md "Study screen". */
  studyTheme?: "dark" | "follow";
}

export default function NinjaStage({
  view,
  stageRef,
  tileElRefs,
  stateRef,
  langCode = "zh",
  exitHref = "/dashboard",
  studyTheme = "dark",
}: NinjaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [shakeOffset, setShakeOffset] = useState(0);
  const prevComboRef = useRef(0);
  // Lazy initializer, not an effect + setState — avoids react-hooks/set-state-in-effect
  // and is strictly simpler: localStorage is read once, synchronously, as the
  // initial value, not synchronized in after mount.
  const [bestStats, setBestStats] = useState<{ score: number; combo: number; waves?: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("ninja-best-run");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isNewBest, setIsNewBest] = useState(false);
  // Missed/wrong words this run, deduped by char with a miss count — shown
  // as "Toughest this round" at game-over so the corrective value of a miss
  // doesn't evaporate the moment the session ends. Mirrored into
  // toughestList state (below) because the render below needs the sorted
  // top-3 and reading a ref's value during render is disallowed.
  const toughestRef = useRef(new Map<string, { char: string; translation: string; count: number }>());
  const [toughestList, setToughestList] = useState<
    Array<{ char: string; translation: string; count: number }>
  >([]);
  const [floatingScores, setFloatingScores] = useState<
    Array<{ id: number; points: number; combo: number }>
  >([]);
  const floatingIdRef = useRef(0);
  const [confettiFire, setConfettiFire] = useState(0);
  const prevScoreRef = useRef(0);

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
    const { kind, char, translation } = view.lastOutcome;
    if (kind === "correct") {
      void playAudio(char, "word", langCode);
    } else {
      // Wrong slice keeps its cue; a missed (fallen) target no longer plays
      // the paper-tear sound — it read as random noise since nothing else
      // was tied to it before the life-loss fix, and now the heart dropping
      // + red banner already carry that signal without an extra sting.
      if (kind === "wrong") playSliceWrong();
      void playAudio(char, "word", langCode);

      const existing = toughestRef.current.get(char);
      toughestRef.current.set(char, {
        char,
        translation,
        count: (existing?.count ?? 0) + 1,
      });
      // Mirrors an external ref mutation (toughestRef, kept for O(1) dedup
      // lookup) into render-safe state; render must not read ref.current
      // directly.
      setToughestList([...toughestRef.current.values()].sort((a, b) => b.count - a.count));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.lastOutcome]);

  // Floating "+N ×combo" score number on every correct slice. score only
  // ever increases mid-run, so a rising delta always means a fresh slice —
  // reset to 0 by the game-over/replay flow along with prevScoreRef.
  useEffect(() => {
    const delta = view.score - prevScoreRef.current;
    prevScoreRef.current = view.score;
    if (delta <= 0) return;
    const id = floatingIdRef.current++;
    setFloatingScores((prev) => [...prev, { id, points: delta, combo: view.combo }]);
    const timer = setTimeout(() => {
      setFloatingScores((prev) => prev.filter((f) => f.id !== id));
    }, 900);
    return () => clearTimeout(timer);
  }, [view.score, view.combo]);

  // Hit-stop + screen shake on correct slice. Intensity scales with combo.
  // The shake auto-decays over 100ms via a separate effect.
  useEffect(() => {
    if (!view.lastOutcome || view.lastOutcome.kind !== "correct") return;
    // Intensity from 0.8 (combo 0–2) to 1.0 (combo 5+)
    const intensity = Math.min(1, 0.8 + view.combo / 20);
    // This is synchronizing a transient DOM shake with an external event
    // (the game engine resolving a slice), not deriving render state from
    // props; the setTimeout reset below is the actual "subscribe to
    // external system" half of the pattern the lint rule wants.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShakeIntensity(intensity);
    setShakeOffset(Math.random() * 4 - 2);
    const timer = setTimeout(() => setShakeIntensity(0), 100);
    // playSlice (whoosh) removed — hit-stop, splatter, and floating score
    // already carry the feedback.
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.lastOutcome]);

  // Combo milestone rewards (10/15) — fire celebratory arpeggio.
  // Milestone 5 removed to reduce sound density per wave.
  useEffect(() => {
    const milestones = [10, 15];
    if (view.combo > prevComboRef.current && milestones.includes(view.combo)) {
      playCelebrate();
    }
    prevComboRef.current = view.combo;
  }, [view.combo]);

  // Check for new personal bests when game ends
  useEffect(() => {
    if (view.waveStatus !== "game-over") return;
    if (typeof window === "undefined") return;

    const currentWaves = view.waveIndex + 1;
    const bestWaves = bestStats?.waves ?? 0;
    const newBest = !bestStats || currentWaves > bestWaves;
    // Reacting to the engine (external system) transitioning to game-over
    // and, below, persisting to localStorage (another external system) —
    // not deriving state purely from props/state, so this isn't the pattern
    // the rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsNewBest(newBest);

    if (newBest) {
      const updated = {
        score: Math.max(bestStats?.score ?? 0, view.score),
        combo: Math.max(bestStats?.combo ?? 0, view.bestCombo),
        waves: Math.max(bestWaves, currentWaves),
      };
      setBestStats(updated);
      try {
        localStorage.setItem("ninja-best-run", JSON.stringify(updated));
      } catch {
        // Silently ignore storage errors
      }
    }

    // Confetti on a fresh personal best — the screenshot-worthy moment.
    if (newBest) {
      setConfettiFire((c) => c + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.waveStatus]);

  const livesLeft = Math.max(view.lives, 0);
  // Background warms toward amber as combo climbs, capped well below full
  // saturation so it stays a mood cue, not a color swap. Resets with combo
  // (state.combo already zeroes on miss/wrong — see engine.ts).
  const comboWarmth = Math.min(view.combo, 8) / 8;

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        // 100dvh (dynamic viewport height), not `inset-0` — on mobile browsers
        // `inset-0` against the large viewport extends behind the address/
        // toolbar chrome, which pushed the tile launch point (near the stage
        // floor) out of view. dvh tracks the *visible* viewport instead.
        height: "100dvh",
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

      {/* Ink-wash ground: a faint fibrous texture so the stage reads as
          paper rather than a flat UI panel. Pure CSS (two overlapping radial-
          gradient grains) — no image asset. A raw washi-texture JPEG was
          tried and dropped (2.7MB, unreferenced dead weight) — if a real
          texture is wanted later it needs to be pre-optimized, not raw. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, var(--foreground) 0.5px, transparent 0.5px), radial-gradient(circle at 70% 65%, var(--foreground) 0.5px, transparent 0.5px)",
          backgroundSize: "3px 3px, 5px 5px",
        }}
        aria-hidden="true"
      />

      {/* HUD — X exits mid-session, same affordance/placement as
          SessionHud's flashcard HUD (Link to exitHref, no confirm dialog:
          Ninja is practice-only and never touches the review schedule, so
          there's nothing to lose by leaving). */}
      <header className="grid shrink-0 grid-cols-3 items-center px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex items-center gap-1 justify-self-start">
          <Button asChild variant="ghost" size="icon" className="size-7 sm:size-8">
            <Link href={exitHref} aria-label="Exit session">
              <XIcon className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <div
            className="flex items-center gap-0.5"
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
        </div>

        <span className="justify-self-center text-sm font-bold tabular-nums text-foreground sm:text-base">
          {view.waveIndex + 1}
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
            className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-1.5 duration-200"
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
            <div className="flex flex-col items-center gap-0.5">
              <p data-term className="text-5xl font-bold leading-tight sm:text-6xl">
                {view.lastOutcome.char}
              </p>
              {/* No explicit color: the banner sets `color` on this subtree
                  (--success-foreground / --destructive-foreground), and those
                  invert between themes. An explicit text-* color class opts
                  out of that swap and lands near-white on light-green in dark
                  mode (2:1). Same reason there's no opacity here — these token
                  pairs have too little luminance margin to absorb an alpha cut
                  and still clear AA. */}
              {view.lastOutcome.phonetic && (
                <p className="text-sm font-medium sm:text-base">
                  {view.lastOutcome.phonetic}
                </p>
              )}
            </div>
            <p className="text-sm font-medium">{gameGloss({ translation: view.lastOutcome.translation })}</p>
          </div>
        ) : (
          <div
            key={`${view.waveIndex}-${view.promptWord.wordId}`}
            className="animate-in fade-in zoom-in-95 duration-200"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Slice the word for
            </p>
            <p className="mt-0.5 text-3xl font-bold font-serif leading-tight sm:text-4xl">
              {gameGloss({ translation: view.promptWord.translation }, 80)}
            </p>
          </div>
        )}
      </div>

      {/* Stage — darker than the page background for contrast with tiles.
          The shake transform lives here, not on the outer fixed shell, so a
          hit-stop shake only re-composites the stage subtree, not the two
          full-viewport grain overlays + HUD above it. */}
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden transition-transform"
        style={
          {
            touchAction: "none",
            overscrollBehavior: "contain",
            // Dark focus (default): a fixed dark tone regardless of app
            // theme — Ninja stays a dim arcade stage even in a light app.
            // Follow: track the app theme via CSS vars, so a dark app theme
            // no longer leaves Ninja stuck bright.
            backgroundColor:
              studyTheme === "follow" ? "var(--muted)" : "oklch(0.19 0.014 60)",
            // Read by InkCanvas so the trail/burst colours also flip instead
            // of hardcoded black-on-dark.
            "--ninja-ink": studyTheme === "follow" ? "var(--foreground)" : "oklch(0.93 0.014 85)",
            transform:
              shakeIntensity > 0
                ? `translate(${shakeOffset * shakeIntensity}px, ${shakeOffset * shakeIntensity}px)`
                : undefined,
            transitionDuration: "60ms",
          } as React.CSSProperties
        }
      >
        {view.tiles.map((tile) => (
          <NinjaTile
            key={tile.id}
            tile={tile}
            tileElRefs={tileElRefs}
          />
        ))}

        {/* Ink canvas renders last so trail is on top */}
        <InkCanvas ref={canvasRef} stateRef={stateRef} />

        {/* Floating "+N ×combo" score popups, one per correct slice. */}
        {floatingScores.map((f) => (
          <div
            key={f.id}
            className="pointer-events-none absolute left-1/2 top-1/3 z-40 -translate-x-1/2 animate-[float-score_900ms_ease-out_forwards] text-2xl font-bold text-primary sm:text-3xl"
            aria-hidden="true"
          >
            +{f.points}
            {f.combo >= 2 && <span className="ml-1 text-base opacity-80">×{f.combo}</span>}
          </div>
        ))}

        <ConfettiCannon fire={confettiFire} intensity={160} />

        {view.waveStatus === "game-over" && (
          <div className="animate-in fade-in absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background/95 px-6 text-center backdrop-blur-sm duration-300">
            <div className="space-y-3">
              {/* Session stats — waves as the primary metric (reps = effort),
                  with personal best alongside. */}
              <div className="space-y-2">
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
                  <p className="text-4xl font-bold font-serif tabular-nums text-primary sm:text-5xl">
                    {view.waveIndex + 1}
                  </p>
                  <div className="flex flex-col items-start gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      waves
                    </p>
                    {bestStats?.waves && bestStats.waves > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Best: {bestStats.waves}
                      </p>
                    )}
                  </div>
                </div>

                {/* New Best! indicator */}
                {isNewBest && (
                  <p className="pt-1 text-sm font-semibold text-primary animate-pulse">
                    ✨ New Best! ✨
                  </p>
                )}
              </div>

              {/* Session details */}
              <div className="space-y-1 pt-2 border-t border-muted text-sm">
                <p className="text-muted-foreground">
                  {view.correct} of {view.waveIndex + 1} correct
                </p>
                <p className="flex items-center justify-center gap-1.5 text-muted-foreground">
                  <Flame className="size-4 text-primary" aria-hidden="true" />
                  Best combo: {view.bestCombo}
                </p>
              </div>

              {/* Toughest this round — the words that cost a life, so the
                  session's corrective value survives past the pause banner. */}
              {toughestList.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-muted text-left">
                  <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Toughest this round
                  </p>
                  <ul className="space-y-0.5">
                    {toughestList.slice(0, 3).map((w) => (
                        <li key={w.char} className="flex items-center justify-between gap-3 text-sm">
                          <span data-term className="font-semibold">{w.char}</span>
                          <span className="truncate text-muted-foreground">{gameGloss({ translation: w.translation })}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
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
