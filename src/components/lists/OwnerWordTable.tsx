"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MeaningCell,
  StrengthCell,
  type WordRow,
} from "@/components/lists/WordTable";

/** Editable word table for list owners: inline edit + delete per row. */
export function OwnerWordTable({ words }: { words: WordRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Term</TableHead>
          <TableHead>Reading</TableHead>
          <TableHead>Meaning</TableHead>
          <TableHead>Strength</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {words.map((w) => (
          <OwnerWordRow key={w.id} word={w} />
        ))}
        {words.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="py-6 text-center text-sm text-muted-foreground"
            >
              No words yet. Add one above or import a batch.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function OwnerWordRow({ word }: { word: WordRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const [term, setTerm] = useState(word.term);
  const [phonetic, setPhonetic] = useState(word.phonetic ?? "");
  const [translation, setTranslation] = useState(word.translation);

  async function save() {
    if (!term.trim() || !translation.trim()) {
      toast.error("A word needs a term and a meaning.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/words/${word.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: term.trim(),
        translation: translation.trim(),
        phonetic: phonetic.trim() ? phonetic.trim() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not save the word.");
      return;
    }
    toast.success("Word updated.");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/words/${word.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not delete the word.");
      return;
    }
    toast.success("Word deleted.");
    router.refresh();
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell>
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            maxLength={200}
            aria-label="Term"
          />
        </TableCell>
        <TableCell>
          <Input
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
            maxLength={200}
            aria-label="Reading"
          />
        </TableCell>
        <TableCell>
          <Input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            maxLength={200}
            aria-label="Meaning"
          />
        </TableCell>
        <TableCell />
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTerm(word.term);
                setPhonetic(word.phonetic ?? "");
                setTranslation(word.translation);
                setEditing(false);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="text-base font-medium">{word.term}</TableCell>
      <TableCell className="text-muted-foreground">
        {word.phonetic ?? "—"}
      </TableCell>
      <TableCell>
        <MeaningCell word={word} />
      </TableCell>
      <TableCell>
        <StrengthCell word={word} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {confirmingDelete ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={remove}
                disabled={busy}
              >
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
