"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import type { StudyScope } from "@/lib/studyScope";
import { cn } from "@/lib/utils";

interface ListSummary {
  id: string;
  name: string;
  languageCode: string;
  enrolledCount: number;
}

interface ScopePickerProps {
  value: StudyScope;
  onChange: (scope: StudyScope) => void;
}

/**
 * Collapsed pill that expands into an inline language + list picker. Fetches
 * languages/lists on first expand. Only enrolled lists (enrolledCount > 0) can
 * be picked; anything else is hinted as hidden.
 */
export function ScopePicker({ value, onChange }: ScopePickerProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lists, setLists] = useState<ListSummary[]>([]);

  // Fetch reference data the first time the panel opens.
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    (async () => {
      try {
        const listRes = await fetch("/api/lists");
        const listData = listRes.ok ? await listRes.json() : { lists: [] };
        if (!active) return;
        setLists(listData.lists ?? []);
        setLoaded(true);
      } catch {
        // Leave unloaded; panel shows empty state.
      }
    })();
    return () => {
      active = false;
    };
  }, [open, loaded]);

  // Prune persisted listIds that aren't among the enrollable fetched lists.
  useEffect(() => {
    if (!loaded || !value.listIds || value.listIds.length === 0) return;
    const enrollable = new Set(
      lists.filter((l) => l.enrolledCount > 0).map((l) => l.id)
    );
    const pruned = value.listIds.filter((id) => enrollable.has(id));
    if (pruned.length !== value.listIds.length) {
      onChange({
        ...value,
        listIds: pruned.length > 0 ? pruned : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lists]);

  const enrollableLists = lists.filter((l) => l.enrolledCount > 0);
  const hiddenCount = lists.filter((l) => l.enrolledCount === 0).length;

  const selectedListCount = value.listIds?.length ?? 0;
  const summary = selectedListCount > 0 ? `${selectedListCount} ${selectedListCount === 1 ? "list" : "lists"}` : "All your words";

  function toggleList(id: string) {
    const current = value.listIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    onChange({ ...value, listIds: next.length > 0 ? next : undefined });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border p-3">

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Lists</p>
            {enrollableLists.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {enrollableLists.map((l) => (
                  <ScopeChip
                    key={l.id}
                    active={(value.listIds ?? []).includes(l.id)}
                    onClick={() => toggleList(l.id)}
                    label={l.name}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No enrolled lists here yet.
              </p>
            )}
            {hiddenCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {hiddenCount} {hiddenCount === 1 ? "list is" : "lists are"} hidden
                until you add words from {hiddenCount === 1 ? "it" : "them"}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}
