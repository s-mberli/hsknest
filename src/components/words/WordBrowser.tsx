"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WordStrengthGrid } from "@/components/words/WordStrengthGrid";
import { WordTimeline } from "@/components/words/WordTimeline";
import { WordRetentionList } from "@/components/words/WordRetentionList";
import type { WordDetail } from "@/components/words/WordHoverCard";
import { cn } from "@/lib/utils";
import { isDueNow } from "@/lib/horizon";
import {
  STRENGTH_META,
  STRENGTH_ORDER,
  type Strength,
  wordStrength,
} from "@/lib/strength";

interface ApiWord {
  wordId: string;
  term: string;
  phonetic: string | null;
  translation: string;
  metadata?: unknown;
  languageCode: string;
  languageName: string;
  state: string;
  intervalDays: number;
  lapses: number;
  dueAt: string | null;
  easeFactor: number | null;
  repetitions: number | null;
}

type Filter = "all" | Strength;
type View = "timeline" | "cards" | "list";

export function WordBrowser() {
  const router = useRouter();
  const [words, setWords] = useState<WordDetail[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  // Language filter ("all" = every language) and the due-only queue toggle.
  const [language, setLanguage] = useState<string>("all");
  const [dueOnly, setDueOnly] = useState(false);
  // View mode — Timeline (default), Strength grid, or a retention-sparkline list.
  const [view, setView] = useState<View>("timeline");
  const [masteryThresholdDays, setMasteryThresholdDays] = useState<
    number | null
  >(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/words");
        if (!res.ok) throw new Error("fetch failed");
        const data: {
          words: ApiWord[];
          targetLanguageCode?: string | null;
          masteryThresholdDays?: number | null;
        } = await res.json();
        if (!active) return;
        setMasteryThresholdDays(data.masteryThresholdDays ?? null);
        // Default the filter to the user's target language so words from
        // other languages never mix in unasked — even when the user has no
        // words in the target language yet (they get an empty state instead).
        if (data.targetLanguageCode) {
          setLanguage(data.targetLanguageCode);
        }
        setWords(
          data.words.map((w) => ({
            wordId: w.wordId,
            term: w.term,
            phonetic: w.phonetic,
            translation: w.translation,
            metadata: w.metadata,
            strength: wordStrength({
              state: w.state,
              intervalDays: w.intervalDays,
              lapses: w.lapses,
            }),
            intervalDays: w.intervalDays,
            lapses: w.lapses,
            dueAt: w.dueAt,
            languageCode: w.languageCode,
            languageName: w.languageName,
            state: w.state,
            easeFactor: w.easeFactor,
            repetitions: w.repetitions,
          }))
        );
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Distinct languages among loaded words (code → name), with per-language counts.
  const languages = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const w of words ?? []) {
      const entry = map.get(w.languageCode);
      if (entry) entry.count += 1;
      else map.set(w.languageCode, { name: w.languageName, count: 1 });
    }
    return Array.from(map, ([code, v]) => ({ code, ...v }));
  }, [words]);

  // Words after the language filter — the base for strength counts + chips.
  const inLanguage = useMemo(
    () =>
      language === "all"
        ? (words ?? [])
        : (words ?? []).filter((w) => w.languageCode === language),
    [words, language]
  );

  const dueCount = useMemo(() => {
    const now = Date.now();
    return inLanguage.filter((w) => isDueNow(w, now)).length;
  }, [inLanguage]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inLanguage.length };
    for (const b of STRENGTH_ORDER) c[b] = 0;
    for (const w of inLanguage) c[w.strength] += 1;
    return c;
  }, [inLanguage]);

  // Final list handed to the grid: language filter, then optional due-only
  // narrowing sorted by dueAt ascending ("what comes next" in the queue).
  const visibleWords = useMemo(() => {
    if (!dueOnly) return inLanguage;
    const now = Date.now();
    return inLanguage
      .filter((w) => isDueNow(w, now))
      .sort(
        (a, b) =>
          new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()
      );
  }, [inLanguage, dueOnly]);

  if (error) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Couldn&apos;t load your words. Please refresh.
      </p>
    );
  }

  if (words === null) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Loading your words…
      </p>
    );
  }

  if (words.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        You haven&apos;t started any words yet. Enroll a list to begin.
      </p>
    );
  }

  const bands: Strength[] | undefined =
    filter === "all" ? undefined : [filter];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border p-0.5">
          <ToggleBtn
            active={view === "timeline"}
            onClick={() => setView("timeline")}
          >
            Timeline
          </ToggleBtn>
          <ToggleBtn active={view === "cards"} onClick={() => setView("cards")}>
            Strength
          </ToggleBtn>
          <ToggleBtn active={view === "list"} onClick={() => setView("list")}>
            Words
          </ToggleBtn>
        </div>
      </div>
      {languages.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={language === "all"}
            onClick={() => setLanguage("all")}
            label="All languages"
            count={words.length}
          />
          {languages.map((l) => (
            <FilterChip
              key={l.code}
              active={language === l.code}
              onClick={() => setLanguage(l.code)}
              label={l.name}
              count={l.count}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={counts.all}
        />
        {STRENGTH_ORDER.map((b) => (
          <FilterChip
            key={b}
            active={filter === b}
            onClick={() => setFilter(b)}
            label={STRENGTH_META[b].label}
            count={counts[b]}
          />
        ))}
        <FilterChip
          active={dueOnly}
          onClick={() => setDueOnly((v) => !v)}
          label="Due now"
          count={dueCount}
        />
      </div>

      <Input
        type="search"
        placeholder="Search words…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {filter === "shaky" && (
        <ShakyBulkBar
          disabled={counts.shaky === 0}
          onDone={() => router.refresh()}
          reload={() => setWords(null)}
        />
      )}

      {inLanguage.length === 0 && language !== "all" ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No words in your target language yet — enroll a list to start.
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <a href="/lists">Browse lists</a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLanguage("all")}>
              Show all languages
            </Button>
          </div>
        </div>
      ) : view === "timeline" ? (
        <WordTimeline
          words={visibleWords}
          search={search}
          bands={bands}
          emptyLabel="No words match this filter."
          masteryThresholdDays={masteryThresholdDays}
        />
      ) : view === "cards" ? (
        <WordStrengthGrid
          words={visibleWords}
          search={search}
          bands={bands}
          emptyLabel="No words match this filter."
        />
      ) : (
        <WordRetentionList
          words={visibleWords}
          search={search}
          bands={bands}
          emptyLabel="No words match this filter."
          masteryThresholdDays={masteryThresholdDays}
        />
      )}
    </div>
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

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
      <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/** Bulk actions for shaky/trouble words — reuses /api/words/weak/* endpoints. */
function ShakyBulkBar({
  disabled,
  onDone,
  reload,
}: {
  disabled: boolean;
  onDone: () => void;
  reload: () => void;
}) {
  const [pending, setPending] = useState<"assume" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "assume" | "reset") {
    setBusy(true);
    const res = await fetch(`/api/words/weak/${action}`, { method: "POST" });
    setBusy(false);
    setPending(null);
    if (!res.ok) {
      toast.error("Could not update these words. Please try again.");
      return;
    }
    const data = await res.json();
    toast.success(
      action === "assume"
        ? `Set ${data.updated} words aside as known.`
        : `Reset ${data.updated} words to fresh.`
    );
    reload();
    onDone();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      {pending ? (
        <>
          <span className="text-sm text-muted-foreground">
            {pending === "assume"
              ? "Set all shaky words as known and stop scheduling them?"
              : "Reset all shaky words back to new? Progress is lost."}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setPending(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={pending === "reset" ? "destructive" : "default"}
            size="sm"
            onClick={() => run(pending)}
            disabled={busy}
          >
            {busy ? "Working…" : pending === "assume" ? "Yes, mark known" : "Yes, reset"}
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">
            Give these a fresh start, or set them aside as known.
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setPending("assume")}
          >
            Mark all as known
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setPending("reset")}
          >
            Reset all progress
          </Button>
        </>
      )}
    </div>
  );
}
