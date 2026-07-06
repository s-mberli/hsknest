/**
 * Minimal text-to-speech via the Web Speech API. Zero dependencies.
 * No-ops gracefully when the browser has no speech synthesis support.
 */

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/** True when the current environment can speak. */
export function speechSupported(): boolean {
  return synth() !== null && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * Chrome populates `getVoices()` asynchronously, returning [] on first call and
 * firing `voiceschanged` once the list is ready. We warm a cache on that event
 * so `hasVoiceFor()` isn't stuck reporting "no voices" right after page load.
 */
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesWired = false;

function refreshVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return cachedVoices;

  const current = s.getVoices();
  if (current.length > 0) cachedVoices = current;

  // Wire the one-time listener lazily, the first time we're asked for voices.
  if (!voicesWired && typeof s.addEventListener === "function") {
    voicesWired = true;
    s.addEventListener("voiceschanged", () => {
      const next = s.getVoices();
      if (next.length > 0) cachedVoices = next;
    });
  }

  return cachedVoices;
}

/**
 * True when a voice exists for `langCode`'s primary subtag (e.g. a "zh-CN"
 * voice satisfies "zh"). Used to decide whether the speaker button is live or
 * shown in a muted "no voice installed" state.
 */
export function hasVoiceFor(langCode: string): boolean {
  if (!langCode) return false;
  return pickVoice(refreshVoices(), langCode) !== null;
}

/**
 * Pick the best voice for a BCP-47 language code (e.g. "zh", "es-ES").
 * Matches on the primary subtag prefix, case-insensitively.
 */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  langCode: string
): SpeechSynthesisVoice | null {
  if (!langCode || voices.length === 0) return null;
  const target = langCode.toLowerCase();
  const prefix = target.split("-")[0];

  // Exact match first, then primary-subtag prefix match.
  return (
    voices.find((v) => v.lang.toLowerCase() === target) ??
    voices.find((v) => v.lang.toLowerCase().split("-")[0] === prefix) ??
    null
  );
}

/**
 * Speak `text` using the best available voice for `langCode`.
 * Cancels any in-flight utterance so rapid taps don't queue up.
 */
export function speak(text: string, langCode?: string): void {
  const s = synth();
  if (!s || !text || typeof SpeechSynthesisUtterance === "undefined") return;

  try {
    s.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (langCode) utter.lang = langCode;

    const voice = langCode ? pickVoice(refreshVoices(), langCode) : null;
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    }

    s.speak(utter);
  } catch {
    // Speech is a nicety — never let it break the study flow.
  }
}
