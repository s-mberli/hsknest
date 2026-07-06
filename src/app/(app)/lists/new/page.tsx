"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface Language {
  id: string;
  name: string;
  code: string;
}

const NEW_LANGUAGE = "__new__";

export default function NewListPage() {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [newLangCode, setNewLangCode] = useState("");

  useEffect(() => {
    fetch("/api/languages")
      .then((res) => (res.ok ? res.json() : { languages: [] }))
      .then((data) => {
        const langs: Language[] = data.languages ?? [];
        setLanguages(langs);
        if (langs.length > 0) setLanguageId(langs[0].id);
        else setLanguageId(NEW_LANGUAGE);
      })
      .finally(() => setLoadingLangs(false));
  }, []);

  const addingLanguage = languageId === NEW_LANGUAGE;

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

      <h1 className="mb-6 mt-3 text-2xl font-bold tracking-tight">New list</h1>

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
              <Select
                id="language"
                value={languageId}
                disabled={loadingLangs}
                onChange={(e) => setLanguageId(e.target.value)}
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
                <option value={NEW_LANGUAGE}>＋ Add a new language…</option>
              </Select>
            </div>

            {addingLanguage && (
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
