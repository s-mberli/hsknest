"use client";

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

  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");

  async function save() {
    if (!draftName.trim()) {
      toast.error("A list needs a name.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draftName.trim(),
        description: draftDescription.trim() ? draftDescription.trim() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not update the list.");
      return;
    }
    toast.success("List updated.");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not delete the list.");
      return;
    }
    toast.success("List deleted.");
    router.push("/lists");
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        You own this list — add, edit, or import words below.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Rename
        </Button>
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
              {busy ? "Deleting…" : "Delete list"}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
