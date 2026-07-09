/**
 * Tiny, dependency-free sound effects via the Web Audio API. No asset files —
 * every blip is synthesised from oscillators with a short gain envelope.
 *
 * Design notes:
 * - The AudioContext is created lazily on first playback (a user gesture), which
 *   keeps mobile browsers (iOS especially) happy — they refuse audio created
 *   outside a gesture.
 * - A module-level `enabled` flag mirrors the user's `soundEffects` setting so
 *   callers don't have to thread it everywhere. Default true; study screens set
 *   it from the loaded user setting.
 * - Every entry point no-ops safely when disabled or unsupported.
 */

let enabled = true;
let ctx: AudioContext | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

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
  // Contexts can start suspended until a gesture; resume best-effort.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Play a single tone. `freq` in Hz, `duration` in seconds. `type` is the
 * oscillator waveform. Gain envelope ramps up fast and decays to silence to
 * avoid clicks. `delay` staggers notes for tiny arpeggios.
 */
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

/** Soft positive blip for a correct grade — higher/brighter for "Easy". */
export function playGrade(quality: number): void {
  if (!enabled) return;
  if (quality >= 5) {
    // Easy — bright two-note lift.
    tone(660, 0.1, "sine", 0.09);
    tone(880, 0.12, "sine", 0.08, 0.06);
  } else if (quality >= 4) {
    // Good — single warm blip.
    tone(620, 0.11, "sine", 0.09);
  } else if (quality >= 3) {
    // Hard-but-got-it — muted lower blip.
    tone(430, 0.12, "triangle", 0.07);
  } else {
    // Again — soft low thud, non-punishing.
    tone(220, 0.14, "triangle", 0.06);
  }
}

/** Celebratory rising arpeggio for combo milestones / confetti moments. */
export function playCelebrate(): void {
  if (!enabled) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, 0.16, "sine", 0.08, i * 0.07));
}
