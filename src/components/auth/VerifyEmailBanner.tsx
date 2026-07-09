"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Dismissible nudge for real (non-guest) accounts with an unverified email.
 * Never blocks study/login — verification is soft. Dismissal is session-only
 * (no persistence), so it reappears on next visit until the user verifies.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  async function resend() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify/resend", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not resend the email.");
        return;
      }
      toast.success("Verification email sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber/5 p-4">
      <p className="text-sm">
        <span className="font-medium">Verify your email</span>{" "}
        <span className="text-muted-foreground">
          We sent a link to {email}.
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={resend}>
          {loading ? "Sending…" : "Resend"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
