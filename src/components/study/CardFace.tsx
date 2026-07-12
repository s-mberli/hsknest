"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  hasVoiceFor,
  primeSpeech,
  speak,
  speechSupported,
  voicesLoaded,
} from "@/lib/speech";
import { CARD_TEXT_CLASSES, type CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";
import { parseMeanings } from "@/lib/meanings";
import { HighlightedSentence } from "@/components/study/HighlightedSentence";
import type { Stage, StudyCard } from "@/hooks/useStudySession";

interface CardFaceProps {
  card: StudyCard;
  stage: Stage;
  interactive: boolean;
  textSize?: CardTextSize;
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
}: CardFaceProps) {
  const sizes = CARD_TEXT_CLASSES[textSize];
  const showPhonetic = stage !== "TERM" && !!card.phonetic;
  const showFull = stage === "FULL";
  const canSpeak = speechSupported();
  const difficult = (card.lapses ?? 0) >= 3;

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
  // All senses shown are equally valid answers, so they get equal visual
  // weight. A character budget (not a scrollbar) keeps the answer glanceable:
  // always ≥2 senses when available, at most 4, fewer when glosses run long.
  const CHAR_BUDGET = 110;
  const shown: typeof meanings = [];
  let used = 0;
  for (const m of meanings) {
    if (shown.length >= 4) break;
    if (shown.length >= 2 && used + m.gloss.length > CHAR_BUDGET) break;
    shown.push(m);
    used += m.gloss.length;
  }
  const overflowCount = meanings.length - shown.length;

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
      {/* Speaker — appears once phonetic is revealed. Muted style when no
          voice for this language is installed; tapping then explains why. */}
      {showPhonetic && canSpeak && (
        <button
          type="button"
          onClick={onSpeak}
          aria-label={speakLive ? "Play pronunciation" : "No voice installed"}
          className={cn(
            "absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-accent",
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

      <p
        className={cn(
          "max-w-full break-words px-2 font-bold leading-tight tracking-tight",
          sizes.term
        )}
      >
        {card.term}
      </p>

      <AnimatePresence>
        {showPhonetic && (
          <motion.p
            key="phonetic"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("text-muted-foreground", sizes.phonetic)}
          >
            {card.phonetic}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFull && (
          <motion.div
            key="full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2 px-2"
          >
            {shown.length <= 1 ? (
              // Long single glosses step down a size so they can't outgrow
              // the card (which clips, not scrolls).
              <p
                className={cn(
                  "max-w-full break-words font-semibold tracking-tight [overflow-wrap:anywhere]",
                  (shown[0]?.gloss ?? card.translation).length > 40
                    ? sizes.phonetic
                    : sizes.translation
                )}
              >
                {shown[0]?.gloss ?? card.translation}
              </p>
            ) : (
              // Multiple senses: same size, numbered — none is "more correct".
              <ol className="flex w-full max-w-full flex-col items-center gap-1">
                {shown.map((sense, i) => (
                  <li
                    key={i}
                    className={cn(
                      "max-w-full break-words font-medium tracking-tight [overflow-wrap:anywhere]",
                      sizes.phonetic
                    )}
                  >
                    <span
                      className={cn(
                        "mr-1.5 text-muted-foreground/50",
                        sizes.secondaryMeaning
                      )}
                    >
                      {i + 1}.
                    </span>
                    {sense.reading && sense.reading !== card.phonetic && (
                      <span
                        className={cn(
                          "mr-1 rounded bg-muted px-1 py-0.5 text-muted-foreground/80",
                          sizes.secondaryMeaning
                        )}
                      >
                        {sense.reading}
                      </span>
                    )}
                    {sense.gloss}
                  </li>
                ))}
                {overflowCount > 0 && (
                  <li className="text-xs text-muted-foreground/60">
                    +{overflowCount} more {overflowCount === 1 ? "meaning" : "meanings"}
                  </li>
                )}
              </ol>
            )}
            {extras.length > 0 && (
              <p className="text-xs italic text-muted-foreground/70">
                ({extras.join(" · ")})
              </p>
            )}
            {/* Example sentence — supplementary, only on real (non-preview)
                cards so the first look stays uncluttered. */}
            {card.sentence && !card.preview && (
              <div className="mt-1 flex flex-col items-center gap-1 border-t border-border/60 pt-2">
                <HighlightedSentence
                  text={card.sentence.text}
                  term={card.term}
                  className="text-sm font-medium text-foreground/90"
                />
                <p className="text-xs text-muted-foreground">
                  {card.sentence.translation}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
          {difficult && (
            <p className="text-xs font-medium text-amber">
              This one&apos;s been tricky — take your time.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
