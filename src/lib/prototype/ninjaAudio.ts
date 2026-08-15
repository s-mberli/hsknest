// PROTOTYPE — throwaway code, not wired to SRS/Prisma/network. Safe to delete.
// Mirrors src/lib/sound.ts's private tone() envelope pattern.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0
): void {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playSlice(combo: number): void {
  const f = 880 * 2 ** (Math.min(combo, 8) / 12);
  tone(f, 0.045, "triangle", 0.05);
  tone(f * 0.66, 0.05, "triangle", 0.04, 0.03);
}

export function playSliceWrong(): void {
  tone(160, 0.18, "sawtooth", 0.07);
  tone(120, 0.14, "sawtooth", 0.05, 0.05);
}

export function playMiss(): void {
  tone(300, 0.12, "sine", 0.045);
  tone(200, 0.2, "sine", 0.035, 0.1);
}
