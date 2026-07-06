"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { hasVoiceFor, speak, speechSupported } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { Stage, StudyCard } from "@/hooks/useStudySession";

interface CardFaceProps {
  card: StudyCard;
  stage: Stage;
  interactive: boolean;
}

const PROMPTS: Record<Stage, string> = {
  TERM: "Can you say it?",
  PHONETIC: "And what does it mean?",
  FULL: "Grade yourself — swipe or use arrows",
};

/** Pull a few glanceable extras out of language-specific metadata. */
function metadataExtras(metadata: StudyCard["metadata"]): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const out: string[] = [];
  const m = metadata as Record<string, unknown>;
  const pick = (key: string, label?: string) => {
    const v = m[key];
    if (typeof v === "string" && v.trim()) {
      out.push(label ? `${label}: ${v}` : v);
    } else if (typeof v === "number") {
      out.push(label ? `${label}: ${v}` : String(v));
    }
  };
  pick("gender");
  pick("pos");
  pick("tone", "tone");
  pick("radical", "radical");
  return out.slice(0, 3);
}

/** Staged-reveal card: TERM → PHONETIC → FULL. Tap advances (handled by parent). */
export function CardFace({ card, stage, interactive }: CardFaceProps) {
  const showPhonetic = stage !== "TERM" && !!card.phonetic;
  const showFull = stage === "FULL";
  const canSpeak = speechSupported();
  const difficult = (card.lapses ?? 0) >= 3;

  // Voice availability is device-specific, so resolve it client-side after
  // mount to avoid a hydration mismatch (and to catch Chrome's async voice load).
  const [voiceReady, setVoiceReady] = useState(false);
  useEffect(() => {
    setVoiceReady(!!card.languageCode && hasVoiceFor(card.languageCode));
  }, [card.languageCode]);

  function onSpeak(e: React.MouseEvent) {
    e.stopPropagation();
    if (!voiceReady) {
      const lang = card.languageCode ?? "this language";
      toast(
        `No ${lang} voice is installed on this device — add one in your system's language settings.`
      );
      return;
    }
    speak(card.term, card.languageCode);
  }

  const extras = showFull ? metadataExtras(card.metadata) : [];

  return (
    <div
      className={cn(
        "flex h-full w-full select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm",
        interactive && "pb-16"
      )}
    >
      {/* Speaker — appears once phonetic is revealed. Muted style when no
          voice for this language is installed; tapping then explains why. */}
      {showPhonetic && canSpeak && (
        <button
          type="button"
          onClick={onSpeak}
          aria-label={voiceReady ? "Play pronunciation" : "No voice installed"}
          className={cn(
            "absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-accent",
            voiceReady
              ? "text-muted-foreground hover:text-foreground"
              : "text-muted-foreground/40 hover:text-muted-foreground"
          )}
        >
          {voiceReady ? (
            <Volume2 className="size-5" />
          ) : (
            <VolumeX className="size-5" />
          )}
        </button>
      )}

      <p className="max-w-full break-words px-2 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
        {card.term}
      </p>

      <AnimatePresence>
        {showPhonetic && (
          <motion.p
            key="phonetic"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-lg text-muted-foreground"
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
            className="flex max-h-40 flex-col items-center gap-2 overflow-y-auto overscroll-contain px-2"
          >
            <p className="max-w-full break-words text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
              {card.translation}
            </p>
            {extras.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {extras.join(" · ")}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt + difficult-word hint. */}
      {interactive && (
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 px-6">
          <p className="text-xs text-muted-foreground">{PROMPTS[stage]}</p>
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
