"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Suggestion {
  phonetic: string;
  translation: string;
}

/**
 * Inline "add a word" row for list owners. For Chinese lists, typing a term
 * looks it up in the bundled dictionary and offers one-tap fills for reading
 * and meaning — always editable, never forced.
 */
export function AddWordRow({
  listId,
  languageCode,
}: {
  listId: string;
  languageCode?: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const debounce = useRef<number | null>(null);

  const dictEnabled =
    languageCode === "zh" || (languageCode?.startsWith("zh-") ?? false);

  useEffect(() => {
    if (!dictEnabled || !term.trim()) {
      setSuggestions([]);
      return;
    }
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/dictionary?term=${encodeURIComponent(term.trim())}&languageCode=${encodeURIComponent(languageCode ?? "")}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        // Suggestions are best-effort; typing on is always fine.
      }
    }, 300);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [term, dictEnabled, languageCode]);

  function applySuggestion(s: Suggestion) {
    setPhonetic(s.phonetic);
    setTranslation(s.translation);
    setSuggestions([]);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !translation.trim()) {
      toast.error("A word needs a term and a meaning.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/lists/${listId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: term.trim(),
          translation: translation.trim(),
          ...(phonetic.trim() ? { phonetic: phonetic.trim() } : {}),
        }),
      });
      if (!res.ok) {
        toast.error("Could not add the word.");
        return;
      }
      toast.success("Word added.");
      setTerm("");
      setTranslation("");
      setPhonetic("");
      setSuggestions([]);
      router.refresh();
    } catch {
      toast.error("Could not add the word — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <form
        onSubmit={add}
        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Term"
          maxLength={200}
          aria-label="Term"
        />
        <Input
          value={phonetic}
          onChange={(e) => setPhonetic(e.target.value)}
          placeholder="Reading (optional)"
          maxLength={200}
          aria-label="Reading"
        />
        <Input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Meaning"
          maxLength={200}
          aria-label="Meaning"
        />
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </Button>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={`${s.phonetic}-${i}`}
              type="button"
              onClick={() => applySuggestion(s)}
              className="rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span className="font-medium">{s.phonetic}</span>
              <span className="text-muted-foreground"> · {s.translation}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
