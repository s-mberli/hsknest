"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ListManageBar({
  listId,
  name,
  description,
}: {
  listId: string;
  name: string;
  description: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");

  async function save() {
    if (!draftName.trim()) {
      toast.error("A list needs a name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDescription.trim() ? draftDescription.trim() : null,
        }),
      });
      if (!res.ok) {
        toast.error("Could not update the list.");
        return;
      }
      toast.success("List updated.");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Could not update the list — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not delete the list.");
        return;
      }
      toast.success("List deleted.");
      router.push("/lists");
    } catch {
      toast.error("Could not delete the list — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="List name"
            maxLength={80}
          />
          <Textarea
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            placeholder="Description (optional)"
            maxLength={280}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setDraftName(name);
              setDraftDescription(description ?? "");
              setEditing(false);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  if (confirmingDelete) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Delete this list?</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmingDelete(false)}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={remove} disabled={busy}>
          {busy ? "Deleting…" : "Delete list"}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        aria-label="List settings"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {menuOpen && (
        <>
          {/* Click-outside catcher: any click outside the menu closes it. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border bg-popover py-1 shadow-md">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                setMenuOpen(false);
                setConfirmingDelete(true);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
