"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { StudyCard } from "@/hooks/useStudySession";
import { audioAvailableFor, playAudio } from "@/lib/audio";
import { parseMeanings } from "@/lib/meanings";
import { hasVoiceFor, speechSupported, voicesLoaded } from "@/lib/speech";

/**
 * Everything CardFace needs to decide whether/how a card can be spoken, and
 * to speak it — voice availability, auto-play-once-per-card, and the two
 * click handlers for the reading and sentence speaker buttons. Extracted
 * because it's a fully self-contained subsystem (own state, own effects,
 * own timing) that only reads `card` — deleting it concentrates every
 * speech concern here rather than scattering it back into the render tree.
 */
export function useCardSpeech(
  card: StudyCard,
  opts: { autoPlay: boolean; showPhonetic: boolean }
) {
  const { autoPlay, showPhonetic } = opts;
  const canSpeak = speechSupported();

  // Rare case: the taught sense's reading differs from the card's displayed
  // phonetic (e.g. a word whose top-ranked meaning uses an alternate
  // pronunciation). The bare term alone can't convey which sense is meant,
  // so prefer the example sentence when one exists — it disambiguates by
  // context. Plain audio synthesis (edge-tts) otherwise reads bare terms
  // correctly, so this is the only remaining case that needs the fallback.
  const topReading = parseMeanings(card)[0]?.reading;
  const readingAmbiguous = !!topReading && !!card.phonetic && topReading !== card.phonetic;
  const speakSentence = readingAmbiguous && !!card.sentence;
  const speakText = speakSentence ? card.sentence!.text : card.term;
  const speakKind: "word" | "sentence" = speakSentence ? "sentence" : "word";

  // Voice availability is device-specific, so resolve it client-side after
  // mount to avoid a hydration mismatch. Mobile browsers load voices late,
  // so we re-check a couple of times and track whether the list is known yet.
  const [voiceReady, setVoiceReady] = useState(false);
  const [voicesKnown, setVoicesKnown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function check() {
      if (cancelled) return;
      setVoiceReady(!!card.languageCode && hasVoiceFor(card.languageCode));
      setVoicesKnown(voicesLoaded());
    }
    check();
    const t1 = setTimeout(check, 600);
    const t2 = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [card.languageCode]);

  // Pre-generated clips play even with no installed voice, so audio is "live"
  // whenever a clip is available OR a Web Speech voice matches (or the voice
  // list hasn't loaded yet — let mobile try).
  const hasClips = audioAvailableFor(card.languageCode);
  const speakLive = hasClips || (canSpeak && (voiceReady || !voicesKnown));

  // Auto-play the term once, the moment its reading is revealed. The tap
  // that advanced the stage is the user gesture that unlocks playback. Keyed
  // per card so re-renders (and voice-list arriving late) don't repeat it.
  const spokenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoPlay || !showPhonetic || !speakLive) return;
    if (spokenFor.current === card.wordId) return;
    spokenFor.current = card.wordId;
    void playAudio(speakText, speakKind, card.languageCode);
  }, [autoPlay, showPhonetic, speakLive, card.wordId, speakText, speakKind, card.languageCode]);

  function onSpeak(e: React.MouseEvent) {
    e.stopPropagation();
    // No clip and no installed voice → nothing will be audible; hint the user.
    const trulyNoVoice =
      !hasClips && voicesKnown && !voiceReady && !!card.languageCode;
    if (trulyNoVoice) {
      const lang = card.languageCode ?? "this language";
      toast(
        `No ${lang} voice is installed on this device — add one in your system's language settings.`
      );
      return;
    }
    void playAudio(speakText, speakKind, card.languageCode);
  }

  function onSpeakSentence(e: React.MouseEvent) {
    e.stopPropagation();
    if (!card.sentence) return;
    void playAudio(card.sentence.text, "sentence", card.languageCode);
  }

  return { canSpeak, hasClips, speakLive, onSpeak, onSpeakSentence };
}
