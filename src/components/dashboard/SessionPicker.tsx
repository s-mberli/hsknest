"use client";

import { useEffect, useState } from "react";

import { ScopePicker } from "@/components/dashboard/ScopePicker";
import { CARDS_PER_MINUTE, type StudyScope } from "@/lib/studyScope";
import { cn } from "@/lib/utils";

type Mode = "cards" | "minutes";

const CARD_OPTIONS: { value: string; label: string }[] = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "all", label: "All" },
];
const MINUTE_OPTIONS = [2, 5, 10];

const STORAGE_KEY = "study-session-choice";
const ALL_LIMIT = 500;

/** Build the /study href for the current selection, including any scope. */
function buildHref(
  mode: Mode,
  cardChoice: string,
  minuteChoice: number,
  scope: StudyScope
) {
  const base =
    mode === "cards"
      ? `/study?limit=${cardChoice === "all" ? ALL_LIMIT : cardChoice}`
      : `/study?minutes=${minuteChoice}`;
  let href = base;
  if (scope.listIds && scope.listIds.length > 0) {
    href += `&listIds=${encodeURIComponent(scope.listIds.join(","))}`;
  }
  return href;
}

/**
 * Resolve the selection to a concrete card count, or null for "no cap" (All).
 * cards → the number; "all" → null; minutes → minutes × CARDS_PER_MINUTE.
 */
function resolveSize(
  mode: Mode,
  cardChoice: string,
  minuteChoice: number
): number | null {
  if (mode === "minutes") return minuteChoice * CARDS_PER_MINUTE;
  if (cardChoice === "all") return null;
  const n = Number(cardChoice);
  return Number.isFinite(n) ? n : null;
}

interface SessionPickerProps {
  /** Called whenever the stored selection changes, with the resolved href. */
  onHrefChange?: (href: string) => void;
  /** Called with the resolved session size (null = All / no cap). */
  onSizeChange?: (size: number | null) => void;
}

/**
 * Small segmented control for session length. Persists the choice to
 * localStorage and lifts the resolved /study href to the parent.
 */
export function SessionPicker({ onHrefChange, onSizeChange }: SessionPickerProps) {
  const [mode, setMode] = useState<Mode>("cards");
  const [cardChoice, setCardChoice] = useState("20");
  const [minuteChoice, setMinuteChoice] = useState(5);
  const [scope, setScope] = useState<StudyScope>({});
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Restore last choice and sync across tabs
  useEffect(() => {
    function loadStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          mode?: Mode;
          cardChoice?: string;
          minuteChoice?: number;
          languageId?: unknown;
          listIds?: unknown;
        };
        if (saved.mode === "cards" || saved.mode === "minutes") {
          setMode(saved.mode);
        }
        if (saved.cardChoice) setCardChoice(saved.cardChoice);
        if (typeof saved.minuteChoice === "number") {
          setMinuteChoice(saved.minuteChoice);
        }
        // Defensively tolerate old blobs
        const restored: StudyScope = {};
        if (Array.isArray(saved.listIds)) {
          const ids = saved.listIds.filter(
            (x): x is string => typeof x === "string" && x.length > 0
          );
          if (ids.length > 0) restored.listIds = ids;
        }
        setScope(restored);
      } catch {
        // ignore malformed storage
      }
    }

    loadStorage();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadStorage();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Keep the parent's Start href in sync + persist on every change.
  useEffect(() => {
    onHrefChange?.(buildHref(mode, cardChoice, minuteChoice, scope));
    onSizeChange?.(resolveSize(mode, cardChoice, minuteChoice));
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode,
          cardChoice,
          minuteChoice,
          listIds: scope.listIds,
        })
      );
    } catch {
      // ignore
    }
  }, [mode, cardChoice, minuteChoice, scope, onHrefChange, onSizeChange]);

  return (
    <div className="w-full max-w-xs space-y-2">
      {/* Primary control: the length chips for the current unit. */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Session length
        </span>
        <span className="text-[11px] text-muted-foreground">
          {mode === "cards" ? "cards" : "minutes"}
        </span>
      </div>
      <div className="grid grid-flow-col auto-cols-fr gap-1.5">
        {mode === "cards"
          ? CARD_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setCardChoice(o.value)}
                className={cn(
                  "rounded-full border py-1.5 text-sm font-medium transition-colors",
                  cardChoice === o.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                {o.label}
              </button>
            ))
          : MINUTE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMinuteChoice(n)}
                className={cn(
                  "rounded-full border py-1.5 text-sm font-medium transition-colors",
                  minuteChoice === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                {n}m
              </button>
            ))}
      </div>

      {/* Secondary controls stay out of the way until asked for. */}
      <details 
        className="group" 
        open={optionsOpen} 
        onToggle={(e) => setOptionsOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none text-center text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Options
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Measure by
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
              {(["cards", "minutes"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-full px-4 py-1 text-xs font-medium capitalize transition-colors",
                    mode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Word scope
            </span>
            <ScopePicker value={scope} onChange={setScope} />
          </div>
        </div>
      </details>
    </div>
  );
}
