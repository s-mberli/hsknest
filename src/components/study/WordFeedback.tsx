"use client";

import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { StudyCard } from "@/hooks/useStudySession";

interface WordFeedbackProps {
  card: StudyCard;
  /** The primary meaning shown on the card, quoted into the report body. */
  primaryText: string;
}

/**
 * Corner flag button + overlay report form for a card. Self-contained: owns
 * its open/message/sending state and the submit handler, coupled to the
 * rest of CardFace only through `card`/`primaryText`. Deleting it just
 * removes the report feature — nothing else depends on its internals.
 */
export function WordFeedback({ card, primaryText }: WordFeedbackProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);

  async function submitWordFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (feedbackMessage.trim().length < 10) {
      return; // Button is disabled, shouldn't reach here
    }
    setFeedbackSending(true);
    try {
      const msg = feedbackMessage.trim();
      const sentenceLine = card.sentence ? `\nSentence: ${card.sentence.text}` : "";
      const fullMessage = `Word report: ${card.term} (${card.phonetic}) — "${primaryText}"${sentenceLine}\n\n${msg}`;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "bug",
          message: fullMessage,
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Could not send that — please try again.");
        setFeedbackSending(false);
        return;
      }
      toast.success("Thanks — we got it.");
      setFeedbackMessage("");
      setFeedbackOpen(false);
      setFeedbackSending(false);
    } catch {
      toast.error("Could not send that — please try again.");
      setFeedbackSending(false);
    }
  }

  return (
    <>
      {/* Corner flag button (subtle trigger). */}
      <button
        type="button"
        onClick={() => setFeedbackOpen((o) => !o)}
        className="absolute right-3 top-3 text-muted-foreground/60 transition-colors hover:text-foreground"
        aria-label="Report this word"
      >
        <Flag className="size-4" />
      </button>

      {/* Overlay form: covers card, no clipping. */}
      {feedbackOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-card p-6"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-foreground">
            Report {card.term}
          </p>
          <motion.form
            onSubmit={submitWordFeedback}
            className="w-full flex flex-col gap-2"
          >
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="What's off with this word's meaning or example? (at least 10 characters)"
              maxLength={2000}
              className="w-full resize-none rounded border border-muted-foreground/20 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={feedbackSending || feedbackMessage.trim().length < 10}
                className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {feedbackSending ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="flex-1 rounded border border-muted-foreground/20 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </>
  );
}
