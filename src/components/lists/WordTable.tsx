"use client";

import { useId, useState } from "react";
import { ChevronDown, Volume2 } from "lucide-react";

import { playAudio } from "@/lib/audio";
import { Meanings } from "@/components/words/Meanings";
import { METER, StrengthMeter } from "@/components/words/StrengthMeter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseMeanings, primaryGloss } from "@/lib/meanings";
import { relativeDueLabel } from "@/lib/horizon";
import { STRENGTH_META, wordStrength, type Strength } from "@/lib/strength";
import { cn } from "@/lib/utils";

export interface WordRow {
  id: string;
  term: string;
  translation: string;
  metadata?: unknown;
  phonetic: string | null;
  state: string | null;
  intervalDays: number | null;
  lapses: number | null;
  dueAt?: string | null;
}

/** Strength band for a row, or null when the word has no progress snapshot. */
function strengthOf(word: WordRow): Strength | null {
  if (!word.state) return null;
  return wordStrength({
    state: word.state,
    intervalDays: word.intervalDays ?? 0,
    lapses: word.lapses ?? 0,
  });
}

/**
 * Meaning cell shared by both list tables: primary gloss + "+N" pill that
 * expands the remaining senses in place (no tooltip — works on touch).
 */
export function MeaningCell({ word }: { word: WordRow }) {
  const [expanded, setExpanded] = useState(false);
  const expandId = useId();
  const meanings = parseMeanings(word);
  const gloss = primaryGloss(word);
  if (meanings.length <= 1) return <>{gloss}</>;
  const extraCount = meanings.length - 1;
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5">
        <span>{gloss}</span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? expandId : undefined}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="inline-flex min-h-11 items-center gap-0.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          +{extraCount}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      </span>
      {expanded && (
        <div id={expandId}>
          <Meanings word={word} />
        </div>
      )}
    </div>
  );
}

/** Strength cell shared by both list tables: meter + band + interval days. */
export function StrengthCell({ word }: { word: WordRow }) {
  const strength = strengthOf(word);
  if (!strength) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  const days = Math.round(word.intervalDays ?? 0);
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <StrengthMeter strength={strength} />
      <span className="w-[5.5rem] truncate text-right text-xs tabular-nums text-muted-foreground">
        {STRENGTH_META[strength].label}
        {days > 0 ? ` · ${days}d` : ""}
      </span>
    </span>
  );
}

/**
 * Mobile row card (visible below 640px): term/reading + strength chip +
 * full-width MeaningCell, with a strength-colored stripe on the left edge.
 * `children` lets the owner table append its action footer.
 */
export function WordCard({
  word,
  children,
}: {
  word: WordRow;
  children?: React.ReactNode;
}) {
  const strength = strengthOf(word);
  const days = Math.round(word.intervalDays ?? 0);
  return (
    <li
      className="relative overflow-hidden rounded-lg border bg-card"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 64px" }}
    >
      {strength && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            METER[strength].className
          )}
        />
      )}
      <div className="space-y-1.5 p-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1">
              <span data-term className="font-semibold">
                {word.term}
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => void playAudio(word.term, "word", "zh")}
                title="Pronounce"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            {word.phonetic && (
              <span className="text-sm text-muted-foreground">
                {word.phonetic}
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {strength
              ? `${STRENGTH_META[strength].label}${days > 0 ? ` · ${days}d` : ""}`
              : "—"}
          </span>
        </div>
        <MeaningCell word={word} />
        {children}
      </div>
    </li>
  );
}

export function WordTable({ words }: { words: WordRow[] }) {
  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <colgroup>
            <col className="w-[28%] min-w-[7rem]" />
            <col className="w-[22%] min-w-[6rem]" />
            <col />
            <col className="w-[20%] min-w-[9rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Reading</TableHead>
              <TableHead>Meaning</TableHead>
              <TableHead>Strength</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {words.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="text-base font-medium">
                  <div className="flex items-center gap-1">
                    <span data-term>{w.term}</span>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => void playAudio(w.term, "word", "zh")}
                      title="Pronounce"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {w.phonetic ?? "—"}
                </TableCell>
                <TableCell>
                  <MeaningCell word={w} />
                </TableCell>
                <TableCell>
                  <StrengthCell word={w} />
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {w.dueAt ? relativeDueLabel(w.dueAt, "in").replace(/^in /, "") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {words.length === 0 ? (
        <div className="sm:hidden rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No words yet. Add one above or import a batch.
        </div>
      ) : (
        <ul className="sm:hidden space-y-2">
          {words.map((w) => (
            <WordCard key={w.id} word={w} />
          ))}
        </ul>
      )}
    </>
  );
}
