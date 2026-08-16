/**
 * Sound effects via Web Audio API. ElevenLabs SFX files preferred when available,
 * falling back to synthesized oscillator tones for compatibility.
 *
 * Design notes:
 * - The AudioContext is created lazily on first playback (a user gesture), which
 *   keeps mobile browsers (iOS especially) happy — they refuse audio created
 *   outside a gesture.
 * - A module-level `enabled` flag mirrors the user's `soundEffects` setting so
 *   callers don't have to thread it everywhere. Default true; study screens set
 *   it from the loaded user setting.
 * - Audio files are fetched once and cached in an in-memory Map to avoid repeated
 *   network calls and decode latency.
 * - Every entry point no-ops safely when disabled or unsupported.
 */

let enabled = true;
let ctx: AudioContext | null = null;
const audioCache = new Map<string, AudioBuffer>();

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
 * Fetch and decode an audio file, caching the AudioBuffer for reuse.
 * Returns null if fetch/decode fails — callers fall back to synth.
 */
async function loadAudio(path: string): Promise<AudioBuffer | null> {
  const ac = audio();
  if (!ac) return null;

  if (audioCache.has(path)) {
    return audioCache.get(path) ?? null;
  }

  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    const decoded = await ac.decodeAudioData(arrayBuf);
    audioCache.set(path, decoded);
    return decoded;
  } catch {
    return null; // Network error, CORS, or decode failure
  }
}

/**
 * Play a pre-loaded AudioBuffer with optional gain.
 * Called after loadAudio succeeds.
 */
function playAudioBuffer(buffer: AudioBuffer, gain = 0.8): void {
  const ac = audio();
  if (!ac) return;

  const source = ac.createBufferSource();
  const gainNode = ac.createGain();
  source.buffer = buffer;
  gainNode.gain.setValueAtTime(gain, ac.currentTime);
  source.connect(gainNode).connect(ac.destination);
  source.start(ac.currentTime);
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

  if (quality >= 4) {
    // Bright two-note lift
    tone(660, 0.1, "sine", 0.09);
    tone(880, 0.12, "sine", 0.08, 0.06);
  } else if (quality >= 3) {
    // Hard-but-got-it — muted lower blip.
    tone(430, 0.12, "triangle", 0.07);
  } else {
    // Again — soft low thud, non-punishing.
    tone(220, 0.14, "triangle", 0.06);
  }
}

/** Celebratory moment for combo milestones — rising arpeggio. */
export function playCelebrate(): void {
  if (!enabled) return;
  // Rising arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, 0.16, "sine", 0.08, i * 0.07));
}

/** Distractor sliced — impact thud sound effect (ElevenLabs) or synth buzz fallback. */
export function playSliceWrong(): void {
  if (!enabled) return;
  void loadAudio("/sounds/ninja/impact-thud.mp3").then((buf) => {
    if (buf) {
      playAudioBuffer(buf, 0.6);
    } else {
      // Fallback: short buzz
      tone(180, 0.14, "sawtooth", 0.06);
    }
  });
}
