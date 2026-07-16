"use client";

import { motion } from "framer-motion";
import { TriangleAlert, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  hasVoiceFor,
  primeSpeech,
  speak,
  speechSupported,
  voicesLoaded,
} from "@/lib/speech";
import {
  CARD_TEXT_CLASSES,
  termSizeClass,
  type CardTextSize,
} from "@/lib/textSize";
import { cn } from "@/lib/utils";
import { parseMeanings } from "@/lib/meanings";
import { HighlightedSentence } from "@/components/study/HighlightedSentence";
import type { Stage, StudyCard } from "@/hooks/useStudySession";

interface CardFaceProps {
  card: StudyCard;
  stage: Stage;
  interactive: boolean;
  textSize?: CardTextSize;
  /** Speak the term automatically the moment the reading is revealed. */
  autoPlay?: boolean;
}

const PROMPTS: Record<Stage, string> = {
  TERM: "Say it first",
  PHONETIC: "What does it mean?",
  FULL: "Grade yourself — swipe or use arrows",
};

const POS_LABELS: Record<string, string> = {
  n: "noun",
  v: "verb",
  a: "adjective",
  d: "adverb",
  r: "pronoun",
  p: "preposition",
  c: "conjunction",
  m: "numeral",
  q: "classifier",
  u: "auxiliary",
  y: "modal",
  phrase: "phrase",
};

/** Pull a few glanceable extras out of language-specific metadata. */
function metadataExtras(metadata: StudyCard["metadata"]): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const out: string[] = [];
  const m = metadata as Record<string, unknown>;

  const formatPos = (val: unknown): string | null => {
    if (typeof val === "string") {
      const tokens = val.split(",").map((s) => s.trim());
      return tokens.map((t) => POS_LABELS[t] ?? t).join(", ");
    }
    if (Array.isArray(val)) {
      return val
        .map((t) => {
          const s = String(t).trim();
          return POS_LABELS[s] ?? s;
        })
        .filter(Boolean)
        .join(", ");
    }
    return null;
  };

  const pick = (key: string, label?: string) => {
    const v = m[key];
    if (key === "pos") {
      const formatted = formatPos(v);
      if (formatted) {
        out.push(label ? `${label}: ${formatted}` : formatted);
      }
      return;
    }
    if (typeof v === "string" && v.trim()) {
      out.push(label ? `${label}: ${v}` : v);
    } else if (typeof v === "number") {
      out.push(label ? `${label}: ${v}` : String(v));
    } else if (Array.isArray(v) && v.length > 0) {
      const joined = v.map(String).filter((s) => s.trim()).join(", ");
      if (joined) {
        out.push(label ? `${label}: ${joined}` : joined);
      }
    }
  };
  pick("gender");
  pick("plural", "pl");
  pick("pos");
  pick("tone", "tone");
  pick("radical", "radical");
  return out.slice(0, 3);
}

/** Staged-reveal card: TERM → PHONETIC → FULL. Tap advances (handled by parent). */
export function CardFace({
  card,
  stage,
  interactive,
  textSize = "normal",
  autoPlay = false,
}: CardFaceProps) {
  const sizes = CARD_TEXT_CLASSES[textSize];
  const showPhonetic = stage !== "TERM" && !!card.phonetic;
  const showFull = stage === "FULL";
  const canSpeak = speechSupported();
  // A word the user keeps forgetting (currently relearning, or lapsed twice+).
  // Never on a brand-new preview — it can't be "difficult" yet.
  const struggling =
    !card.preview && (card.state === "LAPSED" || (card.lapses ?? 0) >= 2);

  // Voice availability is device-specific, so resolve it client-side after
  // mount to avoid a hydration mismatch. Mobile browsers load voices late, so
  // we re-check a couple of times and track whether the list is known yet.
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

  // Live when a voice matches, or when the list hasn't loaded yet (let mobile
  // try). Only show the muted state once voices are known and none match.
  const speakLive = canSpeak && (voiceReady || !voicesKnown);

  // Auto-play the term once, the moment its reading is revealed. The tap that
  // advanced the stage is the user gesture that unlocks synthesis. Keyed per
  // card so re-renders (and voice-list arriving late) don't repeat it.
  const spokenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoPlay || !showPhonetic || !speakLive) return;
    if (spokenFor.current === card.wordId) return;
    spokenFor.current = card.wordId;
    primeSpeech();
    speak(card.term, card.languageCode);
  }, [autoPlay, showPhonetic, speakLive, card.wordId, card.term, card.languageCode]);

  function onSpeak(e: React.MouseEvent) {
    e.stopPropagation();
    primeSpeech();
    const trulyNoVoice = voicesKnown && !voiceReady && !!card.languageCode;
    if (trulyNoVoice) {
      const lang = card.languageCode ?? "this language";
      toast(
        `No ${lang} voice is installed on this device — add one in your system's language settings.`
      );
      return;
    }
    speak(card.term, card.languageCode);
  }

  const extras = showFull ? metadataExtras(card.metadata) : [];
  const meanings = showFull ? parseMeanings(card) : [];
  // Lead with the top-ranked sense; a couple more collapse into one quiet line.
  // A tight character budget keeps the answer glanceable and leaves room for
  // the example sentence below (the card clips, it doesn't scroll).
  const CHAR_BUDGET = 80;
  const shown: typeof meanings = [];
  let used = 0;
  for (const m of meanings) {
    if (shown.length >= 3) break;
    if (shown.length >= 1 && used + m.gloss.length > CHAR_BUDGET) break;
    shown.push(m);
    used += m.gloss.length;
  }
  const primary = shown[0];
  const secondary = shown.slice(1);
  const overflowCount = meanings.length - shown.length;
  const primaryText = primary?.gloss ?? card.translation;

  return (
    <div
      className={cn(
        "flex h-full w-full select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm",
        interactive && "pb-16",
        // Brand-new word previews get a sky-blue treatment so it's obvious
        // this is a first look, not a test.
        card.preview &&
          "border-sky-500/50 shadow-[0_0_36px_-10px_rgba(14,165,233,0.55)]"
      )}
    >
      {card.preview && (
        <span className="absolute left-4 top-4 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          New word
        </span>
      )}
      <p
        className={cn(
          // break-normal: wrap between words only — long terms shrink via
          // termSizeClass instead of ever breaking mid-word.
          "max-w-full break-normal px-2 font-bold leading-tight tracking-tight",
          termSizeClass(card.term, textSize)
        )}
      >
        {card.term}
      </p>

      {/* Reading — a primary recall target, so it reads loud: colored, larger,
          with an inline speaker (which also auto-plays when enabled). */}
      {/* No nested AnimatePresence here: one inside an exiting card blocks
          the parent presence (CardStack) from ever unmounting it — swiped
          cards pile up frozen on screen (`propagate` did not resolve it with
          our stage-driven children). Stages only ever advance within a card,
          so an enter animation is all that's needed. */}
      {showPhonetic && (
          <motion.div
            key="phonetic"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "font-medium tracking-wide text-primary",
                sizes.phonetic
              )}
            >
              {card.phonetic}
            </span>
            {canSpeak && (
              <button
                type="button"
                onClick={onSpeak}
                aria-label={
                  speakLive ? "Play pronunciation" : "No voice installed"
                }
                className={cn(
                  "rounded-full p-1.5 transition-colors hover:bg-accent",
                  speakLive
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                )}
              >
                {speakLive ? (
                  <Volume2 className="size-5" />
                ) : (
                  <VolumeX className="size-5" />
                )}
              </button>
            )}
          </motion.div>
        )}

      {showFull && (
          <motion.div
            key="full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full flex-col items-center gap-1.5 px-2"
          >
            {/* Primary meaning leads; long glosses step down so they can't
                outgrow the card (which clips, not scrolls). */}
            <p
              className={cn(
                "max-w-full break-words font-semibold tracking-tight [overflow-wrap:anywhere]",
                primaryText.length > 40 ? sizes.phoneticHint : sizes.translation
              )}
            >
              {primary?.reading && primary.reading !== card.phonetic && (
                <span
                  className={cn(
                    "mr-1.5 rounded bg-muted px-1 py-0.5 align-middle text-muted-foreground/80",
                    sizes.secondaryMeaning
                  )}
                >
                  {primary.reading}
                </span>
              )}
              {primaryText}
            </p>

            {/* Remaining senses collapse into one quiet line. */}
            {(secondary.length > 0 || overflowCount > 0) && (
              <p
                className={cn(
                  "max-w-full break-words text-muted-foreground [overflow-wrap:anywhere]",
                  sizes.secondaryMeaning
                )}
              >
                {secondary.map((s) => s.gloss).join(" · ")}
                {overflowCount > 0 && (
                  <span className="text-muted-foreground/60">
                    {secondary.length > 0 ? " · " : ""}+{overflowCount} more
                  </span>
                )}
              </p>
            )}

            {extras.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground/80">
                {extras.join(" · ")}
              </span>
            )}

            {/* Example sentence in its own block: sentence → reading → meaning,
                on real (non-preview) cards only. */}
            {card.sentence && !card.preview && (
              <div className="mt-2 w-full max-w-sm rounded-xl bg-muted/40 px-4 py-3 text-left">
                <HighlightedSentence
                  text={card.sentence.text}
                  term={card.term}
                  className="text-base font-medium leading-relaxed text-foreground/90"
                />
                {card.sentence.phonetic && (
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {card.sentence.phonetic}
                  </p>
                )}
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {card.sentence.translation}
                </p>
              </div>
            )}
          </motion.div>
        )}

      {/* Prompt + difficult-word hint. */}
      {interactive && (
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 px-6">
          <p className="text-xs text-muted-foreground">
            {card.preview
              ? stage === "FULL"
                ? "Take it in — it comes back for grading in a moment"
                : "New word — tap to reveal"
              : PROMPTS[stage]}
          </p>
          {struggling && (
            <p className="flex items-center gap-1 text-xs font-medium text-amber">
              <TriangleAlert className="size-3.5" />
              You keep missing this one — slow down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
