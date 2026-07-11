"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseDelimited, type ColumnRole } from "@/lib/import";
import { cn } from "@/lib/utils";

type Delimiter = "auto" | "tab" | "comma";

const DELIMITER_LABELS: { value: Delimiter; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "tab", label: "Tab" },
  { value: "comma", label: "Comma" },
];

const ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: "term", label: "Term" },
  { value: "translation", label: "Translation" },
  { value: "phonetic", label: "Reading" },
  { value: "meanings", label: "Meanings (split on ;)" },
  { value: "ignore", label: "Ignore" },
];

const DEFAULT_ROLES: ColumnRole[] = ["term", "translation", "phonetic"];

/** Split preview rows using the same delimiter rule as the parser (client-side). */
function splitPreview(text: string, delimiter: Delimiter): string[][] {
  const useTab =
    delimiter === "tab" ||
    (delimiter === "auto" &&
      (text.split(/\r\n|\r|\n/).find((l) => l.trim().length > 0)?.includes("\t") ??
        false));
  const sep = useTab ? "\t" : ",";
  return text
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 5)
    .map((line) => line.split(sep));
}

export function ImportWords({
  listId,
  onClose,
}: {
  listId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const [roles, setRoles] = useState<ColumnRole[]>(DEFAULT_ROLES);
  const [submitting, setSubmitting] = useState(false);

  const previewRows = useMemo(
    () => splitPreview(text, delimiter),
    [text, delimiter]
  );
  const columnCount = previewRows.reduce(
    (max, row) => Math.max(max, row.length),
    0
  );

  function roleFor(index: number): ColumnRole {
    return roles[index] ?? "ignore";
  }

  function setRole(index: number, role: ColumnRole) {
    setRoles((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push("ignore");
      next[index] = role;
      return next;
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit() {
    if (!text.trim()) {
      toast.error("Paste some rows or choose a file first.");
      return;
    }
    // Send only the roles for columns present in the data.
    const columns = roles.slice(0, Math.max(columnCount, 1));

    // Client-side sanity check so we can warn on nothing-to-import early.
    const preview = parseDelimited(text, { delimiter, columns });
    if (preview.words.length === 0) {
      toast.error("No importable rows found. Check the column mapping.");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/lists/${listId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, delimiter, columns }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Import failed. Please try again.");
      return;
    }
    const data = await res.json();
    const reasons: string[] = [];
    if (data.reasons?.duplicateInPaste)
      reasons.push(`${data.reasons.duplicateInPaste} duplicate in paste`);
    if (data.reasons?.alreadyInList)
      reasons.push(`${data.reasons.alreadyInList} already in the list`);
    if (data.reasons?.noTerm)
      reasons.push(`${data.reasons.noTerm} missing a term`);
    if (data.reasons?.overCap)
      reasons.push(`${data.reasons.overCap} over the 2000-row cap`);
    toast.success(
      data.skipped > 0
        ? `Imported ${data.added} words — skipped ${reasons.join(", ")}.`
        : `Imported ${data.added} words.`
    );
    setText("");
    onClose();
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Import words</p>
          <p className="text-xs text-muted-foreground">
            Paste rows or choose a file. Works with tab-separated exports from
            other flashcard tools — one word per line, e.g. term&lt;tab&gt;meaning.
            Importing from Anki? Use File → Export → &quot;Notes in Plain
            Text&quot; and paste the result here, then map the columns below.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"你好\thello\n谢谢\tthank you"}
        className="min-h-32 font-mono text-xs"
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={onFile}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          Choose file
        </Button>

        <div className="inline-flex rounded-lg border p-0.5">
          {DELIMITER_LABELS.map((d) => (
            <Button
              key={d.value}
              type="button"
              variant={delimiter === d.value ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7", delimiter !== d.value && "text-muted-foreground")}
              onClick={() => setDelimiter(d.value)}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      {columnCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Preview &amp; column mapping
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {Array.from({ length: columnCount }).map((_, i) => (
                    <th key={i} className="p-1 text-left align-top">
                      <Select
                        value={roleFor(i)}
                        onChange={(e) => setRole(i, e.target.value as ColumnRole)}
                        className="h-8"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, r) => (
                  <tr key={r} className="border-t">
                    {Array.from({ length: columnCount }).map((_, c) => (
                      <td
                        key={c}
                        className="max-w-40 truncate p-1 text-muted-foreground"
                      >
                        {row[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Importing…" : "Import"}
        </Button>
      </div>
    </div>
  );
}
