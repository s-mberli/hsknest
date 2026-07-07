"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddWordRow } from "@/components/lists/AddWordRow";
import { ImportWords } from "@/components/lists/ImportWords";
import { OwnerWordTable } from "@/components/lists/OwnerWordTable";
import { WordTable, type WordRow } from "@/components/lists/WordTable";
import { WordStrengthGrid } from "@/components/words/WordStrengthGrid";
import type { WordDetail } from "@/components/words/WordHoverCard";
import { cn } from "@/lib/utils";
import { wordStrength } from "@/lib/strength";

export interface ListWord {
  id: string;
  term: string;
  translation: string;
  phonetic: string | null;
  state: string | null;
  intervalDays: number | null;
  lapses: number | null;
  dueAt: string | null;
}

type View = "strength" | "table";

export function ListWordsView({
  words,
  listId,
  isOwner = false,
  languageCode,
  languageName,
}: {
  words: ListWord[];
  listId?: string;
  isOwner?: boolean;
  languageCode?: string;
  languageName?: string;
}) {
  // Owners default to the table view where they can manage words.
  const [view, setView] = useState<View>(isOwner ? "table" : "strength");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const details = useMemo<WordDetail[]>(
    () =>
      words.map((w) => ({
        wordId: w.id,
        term: w.term,
        phonetic: w.phonetic,
        translation: w.translation,
        strength: wordStrength({
          state: w.state ?? "NEW",
          intervalDays: w.intervalDays ?? 0,
          lapses: w.lapses ?? 0,
        }),
        intervalDays: w.intervalDays,
        lapses: w.lapses,
        dueAt: w.dueAt,
        languageCode: languageCode ?? "",
        languageName: languageName ?? "",
        state: w.state ?? "NEW",
      })),
    [words, languageCode, languageName]
  );

  const tableRows = useMemo<WordRow[]>(
    () =>
      words.map((w) => ({
        id: w.id,
        term: w.term,
        translation: w.translation,
        phonetic: w.phonetic,
        state: w.state,
      })),
    [words]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border p-0.5">
          <ToggleBtn active={view === "strength"} onClick={() => setView("strength")}>
            Strength
          </ToggleBtn>
          <ToggleBtn active={view === "table"} onClick={() => setView("table")}>
            Table
          </ToggleBtn>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && listId && (
            <Button
              type="button"
              variant={importing ? "secondary" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setImporting((v) => !v)}
            >
              Import words
            </Button>
          )}
          <Input
            type="search"
            placeholder="Search words…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs"
          />
        </div>
      </div>

      {isOwner && listId && importing && (
        <ImportWords listId={listId} onClose={() => setImporting(false)} />
      )}

      {isOwner && listId && (
        <AddWordRow listId={listId} languageCode={languageCode} />
      )}

      {view === "strength" ? (
        <WordStrengthGrid
          words={details}
          search={search}
          emptyLabel="No words match your search."
        />
      ) : isOwner ? (
        <OwnerWordTable words={filterTable(tableRows, search)} />
      ) : (
        <WordTable words={filterTable(tableRows, search)} />
      )}
    </div>
  );
}

function filterTable(rows: WordRow[], q: string): WordRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (r) =>
      r.term.toLowerCase().includes(needle) ||
      (r.phonetic?.toLowerCase().includes(needle) ?? false) ||
      r.translation.toLowerCase().includes(needle)
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn("h-8", !active && "text-muted-foreground")}
    >
      {children}
    </Button>
  );
}
