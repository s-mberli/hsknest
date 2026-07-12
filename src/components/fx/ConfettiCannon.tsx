"use client";

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/lib/motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  size: number;
  color: string;
  life: number;
}

const COLOR_VARS = ["--primary", "--amber", "--success"];
const GRAVITY = 0.35;
const DRAG = 0.98;
const TERMINAL_VY = 11;

function readThemeColors(): string[] {
  const styles = getComputedStyle(document.documentElement);
  return COLOR_VARS.map((v) => styles.getPropertyValue(v).trim()).filter(Boolean);
}

function spawnBurst(
  colors: string[],
  originX: number,
  originY: number,
  count: number
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI / 2) + (Math.random() - 0.5) * (Math.PI * 0.9);
    const speed = 7 + Math.random() * 9;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
      rotation: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      size: 5 + Math.random() * 5,
      color: colors[i % colors.length],
      life: 1,
    });
  }
  return particles;
}

interface ConfettiCannonProps {
  /** Bump this counter to trigger a new burst. */
  fire: number;
  /** Particle count for the burst; smaller for combo milestones, larger for wins. */
  intensity?: number;
}

/**
 * Self-contained canvas confetti burst (spring/physics-based, not eased CSS).
 * Reads its palette from the live theme so it matches light/dark automatically.
 * No-ops entirely under prefers-reduced-motion.
 */
export function ConfettiCannon({ fire, intensity = 120 }: ConfettiCannonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const firstRun = useRef(true);

  useEffect(() => {
    // Skip the initial mount value — only fire on subsequent bumps.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (reducedMotion || fire === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const colors = readThemeColors();
    const originX = canvas.clientWidth / 2;
    const originY = canvas.clientHeight * 0.35;
    particlesRef.current = spawnBurst(colors, originX, originY, intensity);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.vx *= DRAG;
        p.vy = Math.min(p.vy + GRAVITY, TERMINAL_VY);
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.life -= 0.014;

        if (p.life > 0 && p.y < canvas.clientHeight + 20) {
          alive.push(p);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }
      }
      particlesRef.current = alive;

      if (alive.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-50 h-full w-full"
      aria-hidden="true"
    />
  );
}
