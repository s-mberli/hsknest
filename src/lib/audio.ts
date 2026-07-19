/**
 * Natural pronunciation audio: pre-generated MP3 clips (Kokoro TTS) served
 * statically, with the Web Speech API (see `@/lib/speech`) as the fallback for
 * missing clips and user-created words.
 *
 * A clip's URL is derived from a SHA-256 of the exact text — the same hash the
 * offline generator (scripts/generate-audio.py) uses for filenames. That means
 * no DB column and no queue-API change: any surface that has the text can find
 * its clip. Content-hash naming also survives DB reseeds (word ids are cuids
 * that change; the text doesn't) and lets a custom word reuse a seeded clip.
 *
 * Set NEXT_PUBLIC_AUDIO_BASE_URL to enable (hosted: "/audio" same-origin).
 * Unset → every call falls straight through to Web Speech (the self-host
 * default), so nothing breaks without the audio volume.
 */

import { primeSpeech, speak } from "@/lib/speech";

export type AudioKind = "word" | "sentence";

const BASE = process.env.NEXT_PUBLIC_AUDIO_BASE_URL?.replace(/\/$/, "") ?? "";

/** Hashes we've already seen 404 for — so a miss falls back instantly next time. */
const missing = new Set<string>();

/**
 * True when generated clips exist for `langCode` (base URL set + a supported
 * language). Lets callers know a device without a Web Speech voice can still
 * produce audio, so they shouldn't show a "no voice installed" dead end.
 */
export function audioAvailableFor(langCode?: string): boolean {
  return !!BASE && (langCode ?? "").split("-")[0] === "zh";
}

/** SHA-256 of `text` (UTF-8), first 20 hex chars — matches the generator. */
async function hashText(text: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 20);
}

/**
 * URL of the pre-generated clip for `text`, or null when audio is disabled
 * (no base URL) or the language has no generated clips (only zh today) — in
 * which case the caller should use Web Speech instead.
 */
export async function audioUrl(
  text: string,
  kind: AudioKind,
  langCode?: string
): Promise<string | null> {
  if (!BASE || !text) return null;
  // Only Mandarin has generated clips for now; everything else uses speech.
  if ((langCode ?? "").split("-")[0] !== "zh") return null;
  const hash = await hashText(text);
  if (!hash) return null;
  const dir = kind === "sentence" ? "s" : "w";
  return `${BASE}/zh/${dir}/${hash}.mp3`;
}

/**
 * Play the natural clip for `text`; fall back to Web Speech on any miss
 * (audio disabled, no clip, decode/network error). `primeSpeech()` is called
 * up front so the fallback works on iOS/Safari, where the tap that triggered
 * playback is the required unlock gesture.
 */
export async function playAudio(
  text: string,
  kind: AudioKind,
  langCode?: string
): Promise<void> {
  primeSpeech();
  const url = await audioUrl(text, kind, langCode);
  if (!url || missing.has(url)) {
    speak(text, langCode);
    return;
  }
  try {
    const audio = new Audio(url);
    audio.addEventListener("error", () => {
      // 404 or decode failure → remember it and speak instead.
      missing.add(url);
      speak(text, langCode);
    });
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        missing.add(url);
        speak(text, langCode);
      });
    }
  } catch {
    speak(text, langCode);
  }
}
