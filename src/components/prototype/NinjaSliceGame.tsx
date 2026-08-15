"use client";

// PROTOTYPE — throwaway code to feel-test a "slice the falling hanzi" mini
// game. NOT wired to SRS/Prisma/network. Safe to delete along with the
// sibling files under src/lib/prototype/ and the route at
// src/app/prototype/ninja-slice/.

import { useEffect, useRef, useState } from "react";
import type { GameState, NinjaTile, TrailPoint } from "@/lib/prototype/ninjaTypes";
import { makeRng, stepTile, tileIsOffStage } from "@/lib/prototype/ninjaPhysics";
import { sweptSliceHit, pointerSpeedPx_s } from "@/lib/prototype/ninjaHitTest";
import { TEST_WORDS, buildWave } from "@/lib/prototype/testWords";
import { playSlice, playSliceWrong, playMiss } from "@/lib/prototype/ninjaAudio";

const LEAD_IN_MS = 1300; // was 700 → 1400 → 1800, dead-air wait felt too long
const WAVE_SIZE = 4;
const TRAIL_MS = 250;
const MIN_SLICE_SPEED = 160; // px/s — was 250, too strict (felt unresponsive)
const HIT_RADIUS_RATIO = 0.9; // was 0.5 — hitbox was noticeably smaller than the tile
const HIT_RADIUS_PAD_PX = 14; // flat extra forgiveness on top of the ratio
const TILE_SIZE_PX_MIN = 44;
const TILE_SIZE_PX_MAX = 72; // was 11vw — ballooned on wide/desktop screens
const TILE_SIZE_VW = 8;
// The visible circular "target" behind each tile — matches the hit radius
// 1:1 so what you see is exactly what you can slice.
const TARGET_CIRCLE_RATIO = HIT_RADIUS_RATIO * 2;
const WAVES_PER_SESSION = 12;
const LIVES = 3;
const FAST_MS = 1200;
const SLOW_MS = 3000;
const ADVANCE_PAUSE_MS = 900;
const TRAIL_CAP = 32;

interface Particle {
  x: number;
  y: number;
  createdAt: number;
  color: string;
}

interface ViewState {
  lives: number;
  waveIndex: number;
  combo: number;
  bestCombo: number;
  correct: number;
  missed: number;
  promptWord: { char: string; translation: string };
  waveStatus: GameState["waveStatus"];
  tiles: { id: string; char: string }[];
}

function initial(): GameState {
  return {
    tiles: [],
    trail: [],
    pointer: null,
    lives: LIVES,
    waveIndex: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    missed: 0,
    stageBounds: { width: 0, height: 0, bottom: 0 },
    promptWord: TEST_WORDS[0],
    waveStatus: "lead-in",
    leadInEnd: 0,
    waveEndTime: null,
  };
}

function projectView(state: GameState): ViewState {
  return {
    lives: state.lives,
    waveIndex: state.waveIndex,
    combo: state.combo,
    bestCombo: state.bestCombo,
    correct: state.correct,
    missed: state.missed,
    promptWord: state.promptWord,
    waveStatus: state.waveStatus,
    tiles: state.tiles.map((t) => ({ id: t.id, char: t.char })),
  };
}

function spawnWave(
  state: GameState,
  rng: () => number,
  wordIndex: number,
  now: number
): void {
  const word = TEST_WORDS[wordIndex % TEST_WORDS.length];
  state.promptWord = word;
  state.tiles = buildWave(word, rng, state.stageBounds, now);
  state.leadInEnd = now + LEAD_IN_MS;
  state.waveEndTime = null;
  state.waveStatus = "lead-in";
}

export default function NinjaSliceGame() {
  const stateRef = useRef<GameState>(initial());
  const [view, setView] = useState<ViewState>(projectView(stateRef.current));
  const rngRef = useRef(makeRng());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileElRefs = useRef(new Map<string, HTMLDivElement>());
  const particlesRef = useRef<Particle[]>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnedRef = useRef(false);

  // Pointer capture + trail recording, and ResizeObserver for stage bounds.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(() => {
      const rect = stage.getBoundingClientRect();
      stateRef.current.stageBounds = {
        width: rect.width,
        height: rect.height,
        bottom: rect.height,
      };
      if (!spawnedRef.current && rect.width > 0) {
        spawnedRef.current = true;
        spawnWave(stateRef.current, rngRef.current, 0, performance.now());
        setView(projectView(stateRef.current));
      }
    });
    observer.observe(stage);

    function pushTrailPoint(clientX: number, clientY: number) {
      const rect = stage!.getBoundingClientRect();
      const point: TrailPoint = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        t: performance.now(),
      };
      const trail = stateRef.current.trail;
      trail.push(point);
      if (trail.length > TRAIL_CAP) trail.shift();
      stateRef.current.pointer = { x: point.x, y: point.y };
    }

    // Only track/slice while the pointer is actually held down (mouse button
    // pressed, or a finger on the glass) — a bare hover/mousemove must never
    // slice. Bug fix: previously pointermove ran unconditionally, so any
    // mouse movement across the stage counted as a slice.
    let down = false;

    function onPointerDown(e: PointerEvent) {
      down = true;
      stage!.setPointerCapture(e.pointerId);
      stateRef.current.trail = []; // fresh stroke, don't hit-test against the last one
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
        // no-op — capture may already be released
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
  }, []);

  // Main RAF loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function stepPhysics(state: GameState, dt: number, now: number) {
      const bounds = state.stageBounds;
      const kept: NinjaTile[] = [];
      for (const tile of state.tiles) {
        if (tile.sliced) continue;
        stepTile(tile, bounds, dt);
        if (tileIsOffStage(tile, bounds)) {
          if (tile.isTarget && state.waveStatus === "live") {
            resolveWave(state, "missed", now);
          }
          continue; // drop off-stage tile
        }
        kept.push(tile);
      }
      // Keep sliced tiles briefly so their DOM node can fade/hide; drop stale ones.
      const sliced = state.tiles.filter((t) => t.sliced);
      state.tiles = [...kept, ...sliced];
    }

    function resolveWave(
      state: GameState,
      kind: "correct" | "wrong" | "missed",
      now: number
    ) {
      if (state.waveStatus !== "live") return;
      state.waveStatus = "resolved";
      state.waveEndTime = now;
      if (kind === "missed") {
        state.missed += 1;
        state.combo = 0;
        playMiss();
      }
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      if (state.lives <= 0) state.waveStatus = "game-over";
    }

    function stepHitTests(state: GameState, now: number) {
      if (state.waveStatus !== "live") return;
      if (!state.pointer) return;
      const trail = state.trail;
      if (trail.length < 2) return;

      // Mirror the CSS clamp() used for rendered tile size so the hitbox
      // matches what's actually on screen.
      const tileSizePx = Math.min(
        Math.max(
          TILE_SIZE_PX_MIN,
          (TILE_SIZE_VW / 100) * state.stageBounds.width
        ),
        TILE_SIZE_PX_MAX
      );
      const radius = HIT_RADIUS_RATIO * tileSizePx + HIT_RADIUS_PAD_PX;

      // Bug fix: this used to test only the newest two trail points. On a
      // fast swipe several points land between hit-test calls (coalesced
      // pointermove events), so the segment that actually crossed the tile
      // was often a few points back and never got checked — the finger
      // would visibly pass through a tile and nothing would happen. Test
      // every consecutive segment in the live trail instead of just the
      // last one, so a swipe that started ON a tile or blew past it in one
      // frame still registers.
      outer: for (let i = 1; i < trail.length; i += 1) {
        const p1 = trail[i - 1];
        const p2 = trail[i];
        const dt = (p2.t - p1.t) / 1000;
        if (dt <= 0) continue;
        const speed = pointerSpeedPx_s(p1, p2, dt);
        if (speed < MIN_SLICE_SPEED) continue;

        for (const tile of state.tiles) {
          if (tile.sliced) continue;
          const hit = sweptSliceHit(p1, p2, tile.position, tile.position, radius);
          if (!hit) continue;
          tile.sliced = true;
          particlesRef.current.push({
            x: tile.position.x,
            y: tile.position.y,
            createdAt: now,
            color: tile.isTarget ? "#4a9d5f" : "#c0392b",
          });

          if (tile.isTarget) {
            const msToSlice = now - state.leadInEnd;
            void (msToSlice < FAST_MS ? 5 : msToSlice < SLOW_MS ? 4 : 3);
            state.combo += 1;
            state.correct += 1;
            playSlice(state.combo);
            resolveWave(state, "correct", now);
          } else {
            state.lives -= 1;
            state.combo = 0;
            playSliceWrong();
            resolveWave(state, "wrong", now);
          }
          break outer; // wave resolves on the first hit either way
        }
      }
    }

    function stepWaveLogic(state: GameState, now: number) {
      if (state.waveStatus === "lead-in" && now >= state.leadInEnd) {
        state.waveStatus = "live";
      }
      if (state.lives <= 0 && state.waveStatus !== "game-over") {
        state.waveStatus = "game-over";
      }
    }

    function physicsSubstep(state: GameState, dt: number, now: number) {
      stepWaveLogic(state, now);
      // Bug fix: tiles were launching and flying immediately at spawn, but
      // slicing was ignored until "live" (after the lead-in delay) — so by
      // the time hits actually counted, tiles were already mid-fall or gone.
      // Freeze tiles in place (just off-screen at the bottom) until live.
      if (state.waveStatus === "live") {
        stepPhysics(state, dt, now);
        stepHitTests(state, now);
      }
      stepWaveLogic(state, now);
    }

    function decayTrail(state: GameState, now: number) {
      while (state.trail.length && now - state.trail[0].t > TRAIL_MS) {
        state.trail.shift();
      }
    }

    function paint(state: GameState, canvas: HTMLCanvasElement | null, now: number) {
      if (!canvas) return;
      const { width, height } = state.stageBounds;
      if (width <= 0 || height <= 0) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const foreground = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      const strokeColor = foreground ? `oklch(${foreground})` : "#333";

      const trail = state.trail;
      if (trail.length >= 2) {
        for (let i = 1; i < trail.length; i += 1) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          const age = (now - p1.t) / TRAIL_MS;
          const alpha = Math.max(0, 1 - age);
          const lineWidth = 1 + 6 * (i / trail.length);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = strokeColor;
          ctx.globalAlpha = alpha * 0.8;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = "round";
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      particlesRef.current = particlesRef.current.filter(
        (p) => now - p.createdAt < 350
      );
      for (const p of particlesRef.current) {
        const age = (now - p.createdAt) / 350;
        const alpha = Math.max(0, 1 - age);
        const radius = 6 + age * 22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha * 0.6;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function paintTilePositions(state: GameState) {
      for (const tile of state.tiles) {
        const el = tileElRefs.current.get(tile.id);
        if (!el) continue;
        if (tile.sliced) {
          el.style.opacity = "0";
          continue;
        }
        // No rotation — spinning tiles were too hard to read at speed.
        el.style.transform = `translate(${tile.position.x}px, ${tile.position.y}px) translate(-50%, -50%)`;
      }
    }

    function loop(now: number) {
      const state = stateRef.current;
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, 0.25);

      if (state.waveStatus === "lead-in" || state.waveStatus === "live") {
        const FIXED = 1 / 60;
        let remaining = dt;
        let substeps = 0;
        while (remaining > 0 && substeps < 5) {
          const step = Math.min(FIXED, remaining);
          physicsSubstep(state, step, now);
          remaining -= step;
          substeps += 1;
        }
      }

      decayTrail(state, now);
      paint(state, canvasRef.current, now);
      paintTilePositions(state);

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
              spawnWave(s, rngRef.current, nextIndex, performance.now());
            }
            setView(projectView(s));
          }, ADVANCE_PAUSE_MS);
        }
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between px-4 py-2 text-sm font-medium">
        <span>Lives: {"❤️".repeat(Math.max(view.lives, 0))}</span>
        <span>
          Wave {Math.min(view.waveIndex + 1, WAVES_PER_SESSION)}/{WAVES_PER_SESSION}
        </span>
        <span>
          Combo {view.combo} (best {view.bestCombo})
        </span>
      </div>

      <div className="mx-4 mb-3 rounded-lg border-2 border-foreground/30 bg-foreground/5 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-wide text-foreground/50">
          Slice the word for
        </p>
        <p className="text-3xl font-bold font-serif leading-tight">
          {view.promptWord.translation}
        </p>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
      >
        {view.tiles.map((tile) => (
          <div
            key={tile.id}
            ref={(el) => {
              if (el) tileElRefs.current.set(tile.id, el);
              else tileElRefs.current.delete(tile.id);
            }}
            className="absolute left-0 top-0 flex select-none items-center justify-center rounded-full border-2 border-foreground/25 bg-background shadow-md"
            style={{
              // Circular "target" backdrop behind each character — makes the
              // slice target visually obvious and matches the hit radius
              // 1:1, so what you see is exactly what you can slice.
              width: `clamp(${TILE_SIZE_PX_MIN * TARGET_CIRCLE_RATIO}px, ${
                TILE_SIZE_VW * TARGET_CIRCLE_RATIO
              }vw, ${TILE_SIZE_PX_MAX * TARGET_CIRCLE_RATIO}px)`,
              aspectRatio: "1 / 1",
              pointerEvents: "none",
              opacity: 1,
              willChange: "transform",
            }}
          >
            <span
              className="font-serif"
              style={{
                fontSize: `clamp(${TILE_SIZE_PX_MIN}px, ${TILE_SIZE_VW}vw, ${TILE_SIZE_PX_MAX}px)`,
              }}
            >
              {tile.char}
            </span>
          </div>
        ))}

        {/* Trail canvas renders LAST so the ink stroke draws on top of the
            tile circles, not hidden behind their opaque backgrounds. */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0"
        />

        {view.waveStatus === "game-over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
            <p className="text-xl font-serif">
              {view.correct}/{WAVES_PER_SESSION} correct
            </p>
            <p className="text-sm">Best combo: {view.bestCombo}</p>
            <button
              type="button"
              onClick={() => location.reload()}
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
