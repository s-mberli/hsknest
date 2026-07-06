"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Inline "add a word" row for list owners. Appends to the list on submit. */
export function AddWordRow({ listId }: { listId: string }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !translation.trim()) {
      toast.error("A word needs a term and a meaning.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/lists/${listId}/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: term.trim(),
        translation: translation.trim(),
        ...(phonetic.trim() ? { phonetic: phonetic.trim() } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not add the word.");
      return;
    }
    toast.success("Word added.");
    setTerm("");
    setTranslation("");
    setPhonetic("");
    router.refresh();
  }

  return (
    <form
      onSubmit={add}
      className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
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
  );
}
