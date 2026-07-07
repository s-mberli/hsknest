"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * "Try as guest" — creates a throwaway account server-side and signs straight
 * in. Rendered on the login and signup pages under a divider.
 */
export function GuestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function tryAsGuest() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not start a guest session.");
        return;
      }
      const { email, password } = await res.json();
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) {
        toast.error("Could not start a guest session.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading}
        onClick={tryAsGuest}
      >
        {loading ? "Setting things up…" : "Just looking? Try it as a guest"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No email needed — a starter list is ready to study right away.
      </p>
    </div>
  );
}
