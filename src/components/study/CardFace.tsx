"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert, Volume2, VolumeX } from "lucide-react";
import {
  CARD_TEXT_CLASSES,
  termSizeClass,
  type CardTextSize,
} from "@/lib/textSize";
import { cn } from "@/lib/utils";
import { parseMeanings } from "@/lib/meanings";
import { HighlightedSentence } from "@/components/study/HighlightedSentence";
import { WordFeedback } from "@/components/study/WordFeedback";
import { useCardSpeech } from "@/hooks/useCardSpeech";
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
  // Core parts of speech
  n: "noun",
  v: "verb",
  a: "adjective",
  d: "adverb",
  r: "pronoun",
  p: "preposition",
  c: "conjunction",
  cc: "paired conj.",
  m: "numeral",
  mq: "measure word",
  q: "classifier",
  qt: "time classifier",
  qv: "verbal classifier",
  u: "auxiliary",
  y: "modal",
  // Compound / derived tags (adjective-adverb, adjective-noun, verb-noun)
  ad: "adj./adv.",
  an: "adj./noun",
  vn: "verb/noun",
  // Proper nouns and subtypes
  nr: "name",
  ns: "place name",
  nt: "organization",
  nz: "proper noun",
  // Other word classes
  b: "attributive",
  e: "interjection",
  f: "locative",
  h: "prefix",
  k: "suffix",
  l: "idiom",
  o: "onomatopoeia",
  s: "spatial",
  t: "time word",
  z: "descriptive",
  // Morpheme variants (less common, shown for completeness)
  tg: "time morph.",
  Mg: "numeral morph.",
  Rg: "pronoun morph.",
  g: "morpheme",
  // Special
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
  // A word the user keeps forgetting (currently relearning, or lapsed twice+).
  // Never on a brand-new preview — it can't be "difficult" yet.
  const struggling =
    !card.preview && (card.state === "LAPSED" || (card.lapses ?? 0) >= 2);

  const { canSpeak, hasClips, speakLive, onSpeak, onSpeakSentence } =
    useCardSpeech(card, { autoPlay, showPhonetic });

  const extras = showFull ? metadataExtras(card.metadata) : [];
  const meanings = showFull ? parseMeanings(card) : [];
  const primary = meanings[0];
  const primaryText = primary?.gloss ?? card.translation;
  const secondary = showFull ? meanings.slice(1, 3) : [];

  // Sentence expander: hide behind a tap to keep FULL reveal clean.
  // Reset on card change via render-time pattern (no effect needed).
  const [showSentence, setShowSentence] = useState(false);
  const [prevWordId, setPrevWordId] = useState(card.wordId);
  if (card.wordId !== prevWordId) {
    setShowSentence(false);
    setPrevWordId(card.wordId);
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm",
        interactive && "pb-16",
        // Brand-new word previews get a sky-blue treatment so it's obvious
        // this is a first look, not a test.
        card.preview &&
          "border-sky-500/50 shadow-[0_0_36px_-10px_rgba(14,165,233,0.55)]"
      )}
    >
      {/* Ink-on-paper: a faint paper grain so the study card carries the same
          identity as Ninja/landing — kept near-invisible on purpose. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,var(--foreground)_1.5px,transparent_0)] [background-size:16px_16px]"
      />
      {card.preview && (
        <span className="absolute left-4 top-4 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          New word
        </span>
      )}
      <p
        data-term
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
            {(canSpeak || hasClips) && (
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
            {/* Primary meaning only — clean and glanceable. */}
            <p
              className={cn(
                "max-w-full break-words font-semibold tracking-tight [overflow-wrap:anywhere]",
                primaryText.length > 40 ? sizes.phoneticHint : sizes.translation
              )}
            >
              {primaryText}
            </p>

            {secondary.map((m, i) => (
              <p
                key={i}
                className="max-w-full break-words text-sm text-muted-foreground/70 [overflow-wrap:anywhere]"
              >
                {m.gloss.length > 40 ? m.gloss.slice(0, 40) + "…" : m.gloss}
              </p>
            ))}
            {meanings.length > 3 && (
              <span className="text-xs text-muted-foreground/50 italic">
                and {meanings.length - 3} more
              </span>
            )}

            {extras.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground/80">
                {extras.join(" · ")}
              </span>
            )}

            {/* Example sentence — behind a tap to keep the FULL reveal clean.
                Expanded once per card, resets on card change. */}
            {card.sentence && !card.preview && (
              <div className="mt-2 w-full max-w-sm">
                {!showSentence ? (
                  <button
                    type="button"
                    onClick={() => setShowSentence(true)}
                    className="w-full rounded-xl border border-dashed border-muted-foreground/20 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
                  >
                    Example sentence
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-muted/40 px-4 py-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <HighlightedSentence
                        text={card.sentence.text}
                        term={card.term}
                        className="text-base font-medium leading-relaxed text-foreground/90"
                      />
                      {(canSpeak || hasClips) && speakLive && (
                        <button
                          type="button"
                          onClick={onSpeakSentence}
                          aria-label="Play sentence"
                          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Volume2 className="size-4" />
                        </button>
                      )}
                    </div>
                    {card.sentence.phonetic && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {card.sentence.phonetic}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {card.sentence.translation}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}

      {/* Report this word: corner flag button + overlay form. */}
      {showFull && !card.preview && (
        <WordFeedback card={card} primaryText={primaryText} />
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
              Tricky one — it&apos;ll come back a little sooner.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
