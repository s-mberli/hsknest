/**
 * React hook: ref-held game loop with minimal re-renders.
 * Fixed timestep, coalesced pointer events, ResizeObserver for stage bounds.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  spawnWave,
  stepPhysics,
  stepHitTests,
  decayTrail,
  stepWaveLogic,
  DEFAULT_CONFIG,
  type EngineConfig,
  type WaveOutcome as EngineWaveOutcome,
} from "@/lib/ninja/engine";
import type { EngineState, StageBounds, TrailPoint } from "@/lib/ninja/types";
import type { NinjaWord } from "@/lib/ninja/distractors";
import { makeRng } from "@/lib/ninja/physics";
import { WAVES_PER_SESSION } from "@/lib/ninja/scoring";

export interface NinjaView {
  lives: number;
  waveIndex: number;
  combo: number;
  bestCombo: number;
  correct: number;
  missed: number;
  promptWord: { char: string; translation: string };
  waveStatus: EngineState["waveStatus"];
  tiles: Array<{ id: string; char: string; position: { x: number; y: number }; sliced: boolean }>;
  pointer: { x: number; y: number } | null;
}

export interface UseNinjaEngineOptions {
  words: NinjaWord[];
  config?: Partial<EngineConfig>;
  onWaveOutcome?: (outcome: EngineWaveOutcome) => void;
}

/**
 * Project engine state into a React view (only interactive fields).
 * Copy position by value to prevent React holding a mutating object.
 */
function projectView(state: EngineState): NinjaView {
  return {
    lives: state.lives,
    waveIndex: state.waveIndex,
    combo: state.combo,
    bestCombo: state.bestCombo,
    correct: state.correct,
    missed: state.missed,
    promptWord: state.promptWord,
    waveStatus: state.waveStatus,
    tiles: state.tiles.map((t) => ({
      id: t.id,
      char: t.char,
      position: { x: t.position.x, y: t.position.y },
      sliced: t.sliced,
    })),
    pointer: state.pointer,
  };
}

function initialState(): EngineState {
  return {
    tiles: [],
    trail: [],
    pointer: null,
    lives: 3,
    waveIndex: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    missed: 0,
    stageBounds: { width: 0, height: 0, bottom: 0 },
    promptWord: { char: "", translation: "" },
    waveStatus: "lead-in",
    leadInEnd: 0,
    waveEndTime: null,
    leadInMs: DEFAULT_CONFIG.leadInMs,
    waveSize: DEFAULT_CONFIG.waveSize,
    trailMs: DEFAULT_CONFIG.trailMs,
  };
}

export function useNinjaEngine({ words, config = {}, onWaveOutcome }: UseNinjaEngineOptions) {
  // Memoize config so effects have stable dependencies
  const fullConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [JSON.stringify(config)] // config is typically {} so this is safe
  );

  const stateRef = useRef<EngineState>(initialState());
  const [view, setView] = useState<NinjaView>(projectView(stateRef.current));
  const rngRef = useRef(makeRng());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tileElRefs = useRef(new Map<string, HTMLDivElement>());
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnedRef = useRef(false);

  /**
   * Paint tiles into the DOM by writing transforms based on current engine state.
   * Called once per RAF frame to move tiles without triggering React re-renders.
   * The visible circle is 1.8x the character size; center it on tile.position.
   */
  function paint(state: EngineState) {
    if (!stageRef.current) return;
    if (state.tiles.length === 0) return;
    if (state.stageBounds.width <= 0) return; // stageBounds not ready yet

    // Compute tile size (matches NinjaTile.tsx sizing logic exactly)
    // NinjaTile uses: clamp(79.2px, 14.4vw, 129.6px) for width
    // which is 1.8 * clamp(44px, 8vw, 72px)
    const charSizePx = Math.min(
      Math.max(
        fullConfig.tileSizePxMin,
        (fullConfig.tileSizeVw / 100) * state.stageBounds.width
      ),
      fullConfig.tileSizePxMax
    );

    // Visual circle diameter is 1.8x the character size (the backdrop)
    const circleDiameter = charSizePx * 1.8;
    const radius = circleDiameter / 2;

    for (const tile of state.tiles) {
      const el = tileElRefs.current.get(tile.id);
      if (!el) continue;

      // Center the circle on tile.position (x,y is the center point)
      const offsetX = tile.position.x - radius;
      const offsetY = tile.position.y - radius;

      el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
  }

  // Pointer capture + trail recording, ResizeObserver for stage bounds
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateBounds = () => {
      const rect = stage.getBoundingClientRect();
      stateRef.current.stageBounds = {
        width: rect.width,
        height: rect.height,
        bottom: rect.height,
      };

      if (!spawnedRef.current && rect.width > 0 && words.length > 0) {
        spawnedRef.current = true;
        const targetWord = words[0];
        const distractorPool = words.slice(1);
        const state = stateRef.current;
        state.leadInMs = fullConfig.leadInMs;
        state.waveSize = fullConfig.waveSize;
        state.trailMs = fullConfig.trailMs;
        spawnWave(state, targetWord, distractorPool, rngRef.current, performance.now(), fullConfig.waveSize);
        setView(projectView(state));
      }
    };

    const observer = new ResizeObserver(updateBounds);
    observer.observe(stage);

    // Fire once synchronously so tiles spawn immediately if stage has size
    updateBounds();

    function pushTrailPoint(clientX: number, clientY: number) {
      const rect = stage!.getBoundingClientRect();
      const point: TrailPoint = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        t: performance.now(),
      };
      const trail = stateRef.current.trail;
      trail.push(point);
      if (trail.length > fullConfig.trailCap) trail.shift();
      stateRef.current.pointer = { x: point.x, y: point.y };
    }

    let down = false;

    function onPointerDown(e: PointerEvent) {
      down = true;
      stage!.setPointerCapture(e.pointerId);
      stateRef.current.trail = [];
      pushTrailPoint(e.clientX, e.clientY);
    }

    function onPointerMove(e: PointerEvent) {
      if (!down) return;
      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ev of events) pushTrailPoint(ev.clientX, ev.clientY);
    }

    function onPointerUp(e: PointerEvent) {
      down = false;
      try {
        stage!.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
      stateRef.current.pointer = null;
      stateRef.current.trail = [];
    }

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);

    return () => {
      observer.disconnect();
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
    };
  }, [fullConfig, words]);

  // Main RAF loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function loop(now: number) {
      const state = stateRef.current;
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, 0.25); // clamp tab-switch gaps

      if (state.waveStatus === "lead-in" || state.waveStatus === "live") {
        const FIXED = 1 / 60;
        let remaining = dt;
        let substeps = 0;
        while (remaining > 0 && substeps < 5) {
          const step = Math.min(FIXED, remaining);
          stepWaveLogic(state, now);
          if (state.waveStatus === "live") {
            stepPhysics(state, step, now);
            const outcome = stepHitTests(state, fullConfig, now);
            if (outcome) {
              onWaveOutcome?.(outcome);
            }
          }
          stepWaveLogic(state, now);
          remaining -= step;
          substeps += 1;
        }
      }

      decayTrail(state, fullConfig, now);
      paint(state);

      if (state.waveStatus === "resolved" || state.waveStatus === "game-over") {
        setView((prev) => {
          const next = projectView(state);
          return prev.waveStatus === next.waveStatus &&
            prev.correct === next.correct &&
            prev.missed === next.missed &&
            prev.lives === next.lives
            ? prev
            : next;
        });

        if (state.waveStatus === "resolved" && !advanceTimerRef.current) {
          advanceTimerRef.current = setTimeout(() => {
            advanceTimerRef.current = null;
            const s = stateRef.current;
            const nextIndex = s.waveIndex + 1;
            if (nextIndex >= WAVES_PER_SESSION || s.lives <= 0) {
              s.waveStatus = "game-over";
            } else {
              s.waveIndex = nextIndex;
              const targetWord = words[nextIndex % words.length];
              const distractorPool = words.filter((_, i) => i !== (nextIndex % words.length));
              spawnWave(s, targetWord, distractorPool, rngRef.current, performance.now(), fullConfig.waveSize);
            }
            setView(projectView(s));
          }, fullConfig.advancePauseMs);
        }
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
    // paint is stable internal logic, don't include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullConfig, words, onWaveOutcome]);

  return {
    stageRef,
    tileElRefs,
    view,
    stateRef,
  };
}
