"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2 } from "lucide-react";

import { playAudio } from "@/lib/audio";

const CARD = {
  hanzi: "是",
  pinyin: "shì",
  meaning: "to be; is; yes",
  pos: "verb",
  sentence: {
    hanzi: "这是我的书。",
    pinyin: "zhè shì wǒ de shū.",
    translation: "This is my book.",
  },
};

type Stage = "term" | "phonetic" | "full";

const PROMPTS: Record<Stage, string> = {
  term: "New word — tap to reveal",
  phonetic: "What does it mean? Tap again",
  full: "Grade yourself",
};

const GRADES = [
  {
    label: "Forgot",
    icon: "✕",
    color: "text-red-500 border-red-200 dark:border-red-900/60",
    feedback: "No worries — you'll see it again soon.",
  },
  {
    label: "Hard",
    icon: "—",
    color: "text-amber-500 border-amber-200 dark:border-amber-900/60",
    feedback: "Got it — back again shortly.",
  },
  {
    label: "Knew",
    icon: "✓",
    color: "text-emerald-500 border-emerald-200 dark:border-emerald-900/60",
    feedback: "Nice! You knew it.",
  },
  {
    label: "Easy",
    icon: "»",
    color: "text-sky-500 border-sky-200 dark:border-sky-900/60",
    feedback: "Easy — pushed further out.",
  },
];

export function FlipCard() {
  const [stage, setStage] = useState<Stage>("term");
  const [feedback, setFeedback] = useState<string | null>(null);

  function advance() {
    if (feedback) return;
    if (stage === "term") {
      setStage("phonetic");
      void playAudio(CARD.hanzi, "word", "zh");
    } else if (stage === "phonetic") {
      setStage("full");
    }
  }

  function grade(e: React.MouseEvent, g: (typeof GRADES)[number]) {
    e.stopPropagation();
    setFeedback(g.feedback);
    setTimeout(() => {
      setFeedback(null);
      setStage("term");
    }, 1400);
  }

  function speak(e: React.MouseEvent, text: string, kind: "word" | "sentence") {
    e.stopPropagation();
    void playAudio(text, kind, "zh");
  }

  const showPhonetic = stage === "phonetic" || stage === "full";
  const showFull = stage === "full";

  return (
    <div
      className="cursor-pointer select-none"
      onClick={advance}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        }
      }}
      aria-label={PROMPTS[stage]}
    >
      <div className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-card">
        {/* NEW WORD badge — hidden once grading (full stage) */}
        <AnimatePresence>
          {stage !== "full" && !feedback && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-4 top-4 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400"
            >
              New word
            </motion.span>
          )}
        </AnimatePresence>

        {/* Character */}
        <p className="text-7xl font-bold leading-tight tracking-tight">
          {CARD.hanzi}
        </p>

        {/* Reading */}
        {showPhonetic && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-2xl font-medium tracking-wide text-primary">
              {CARD.pinyin}
            </span>
            <button
              type="button"
              onClick={(e) => speak(e, CARD.hanzi, "word")}
              aria-label="Play pronunciation"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Volume2 className="size-5" />
            </button>
          </motion.div>
        )}

        {/* Meaning + sentence */}
        {showFull && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full flex-col items-center gap-2"
          >
            <p className="text-lg font-semibold">
              <span className="mr-1.5 rounded bg-muted px-1 py-0.5 align-middle text-xs text-muted-foreground/80">
                {CARD.pos}
              </span>
              {CARD.meaning}
            </p>
            <div className="mt-1 w-full rounded-xl bg-muted/50 p-3 text-left">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-medium">
                    {CARD.sentence.hanzi.split("").map((char, i) => (
                      <span
                        key={i}
                        className={char === "是" ? "text-primary" : ""}
                      >
                        {char}
                      </span>
                    ))}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {CARD.sentence.pinyin}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CARD.sentence.translation}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => speak(e, CARD.sentence.hanzi, "sentence")}
                  aria-label="Play sentence"
                  className="mt-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Volume2 className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Bottom area — prompt, grade buttons, or feedback */}
        <div className="absolute inset-x-0 bottom-5 flex flex-col items-center px-6">
          {feedback ? (
            <motion.p
              key="feedback"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-foreground"
            >
              {feedback}
            </motion.p>
          ) : showFull ? (
            <motion.div
              key="grades"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full justify-center gap-2"
            >
              {GRADES.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={(e) => grade(e, g)}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border bg-card px-2 py-1.5 text-xs transition-transform hover:scale-105 active:scale-95 ${g.color}`}
                >
                  <span className="text-sm leading-none">{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">{PROMPTS[stage]}</p>
          )}
        </div>
      </div>
    </div>
  );
}
