"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";

/**
 * Guest-only nudge: expand into a one-screen form that turns the throwaway
 * account into a real one, keeping every word and review. Shown on the
 * dashboard and in Settings while the session email ends in @guest.local.
 */
export function UpgradeBanner({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(compact);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/account/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not save the account.");
        return;
      }
      // Email changed, so the JWT session must be re-issued.
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) {
        toast.error("Account saved — please sign in with your new email.");
        router.push("/login");
        return;
      }
      toast.success("Account saved — your progress is yours now.");
      trackEvent("guest_upgrade_complete");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-medium">You&apos;re trying HSK Nest as a guest.</span>{" "}
            <span className="text-muted-foreground">
              Add an email and password to keep your progress.
            </span>
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            Save my progress
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm font-medium">
            Keep everything you&apos;ve studied — just pick your login.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="upgrade-email">Email</Label>
              <Input
                id="upgrade-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upgrade-password">Password</Label>
              <Input
                id="upgrade-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Saving…" : "Create my account"}
            </Button>
            {!compact && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Not now
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            At least 8 characters. Your words, lists, and review history stay
            exactly as they are.
          </p>
        </form>
      )}
    </div>
  );
}
