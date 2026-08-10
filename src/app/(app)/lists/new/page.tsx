"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trackEventOnce } from "@/lib/analytics";

interface Language {
  id: string;
  name: string;
  code: string;
}

const NEW_LANGUAGE = "__new__";

export default function NewListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isImportMode = searchParams.get("import") === "true";
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [newLangCode, setNewLangCode] = useState("");
  const [lastRealLanguageId, setLastRealLanguageId] = useState("");

  useEffect(() => {
    fetch("/api/languages")
      .then((res) => (res.ok ? res.json() : { languages: [], targetLanguageId: null }))
      .then((data) => {
        const langs: Language[] = data.languages ?? [];
        setLanguages(langs);
        const target: string | null = data.targetLanguageId ?? null;
        const initial =
          target && langs.some((l) => l.id === target)
            ? target
            : langs.length > 0
              ? langs[0].id
              : NEW_LANGUAGE;
        setLanguageId(initial);
        if (initial !== NEW_LANGUAGE) setLastRealLanguageId(initial);
      })
      .finally(() => setLoadingLangs(false));
  }, []);

  function selectLanguage(id: string) {
    setLanguageId(id);
    if (id !== NEW_LANGUAGE) setLastRealLanguageId(id);
  }

  const addingLanguage = languageId === NEW_LANGUAGE;
  const soleLanguage =
    !addingLanguage && languages.length === 1 ? languages[0] : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your list a name.");
      return;
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    if (addingLanguage) {
      if (!newLangName.trim() || !newLangCode.trim()) {
        toast.error("Enter a language name and code.");
        return;
      }
      body.newLanguage = {
        name: newLangName.trim(),
        code: newLangCode.trim(),
      };
    } else {
      body.languageId = languageId;
    }

    setSaving(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Could not create the list. Please try again.");
      return;
    }
    const data = await res.json();
    toast.success("List created.");
    trackEventOnce("list_created");
    router.push(`/lists/${data.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/lists"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All lists
      </Link>

      <h1 className="mb-6 mt-3 text-2xl font-bold tracking-tight">
        {isImportMode ? "Import from Anki" : "New list"}
      </h1>
      {isImportMode && (
        <div className="mb-6 rounded-lg border border-blue-200/30 bg-blue-50/40 p-4 text-sm text-muted-foreground dark:border-blue-900/30 dark:bg-blue-950/20">
          <p className="mb-3 font-medium text-foreground">How to export from Anki:</p>
          <ol className="space-y-1.5 list-decimal list-inside text-xs">
            <li>Open Anki and select your deck</li>
            <li>Click File → Export</li>
            <li>Choose &quot;Notes in Plain Text&quot; format</li>
            <li>Save the file</li>
          </ol>
          <p className="mt-3 text-xs">Then create a list below and use the &quot;Import batch&quot; button to upload your export.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>List details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen vocabulary"
                maxLength={80}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              {soleLanguage ? (
                <div className="flex items-center justify-between gap-3">
                  <p id="language" className="text-sm">
                    {soleLanguage.name}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => selectLanguage(NEW_LANGUAGE)}
                  >
                    ＋ Add a new language…
                  </Button>
                </div>
              ) : (
                <Select
                  id="language"
                  value={languageId}
                  disabled={loadingLangs}
                  onChange={(e) => selectLanguage(e.target.value)}
                >
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  <option value={NEW_LANGUAGE}>＋ Add a new language…</option>
                </Select>
              )}
            </div>

            {addingLanguage && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-lang-name">New language name</Label>
                    <Input
                      id="new-lang-name"
                      value={newLangName}
                      onChange={(e) => setNewLangName(e.target.value)}
                      placeholder="e.g. Japanese"
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-lang-code">Code</Label>
                    <Input
                      id="new-lang-code"
                      value={newLangCode}
                      onChange={(e) => setNewLangCode(e.target.value)}
                      placeholder="e.g. ja"
                      maxLength={10}
                    />
                  </div>
                </div>
                {lastRealLanguageId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => selectLanguage(lastRealLanguageId)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's in this list?"
                maxLength={280}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button asChild variant="ghost" type="button">
                <Link href="/lists">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create list"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
