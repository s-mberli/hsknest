"use client";

import { Button } from "@/components/ui/button";
import { useGuestStart } from "@/lib/useGuestStart";

/**
 * "Try as guest" — creates a throwaway account server-side and signs straight
 * in. Rendered on the login and signup pages under a divider. Hosted-only —
 * callers must not render this at all when guest mode is disabled (see
 * `isGuestModeEnabled` in `@/lib/registration`); the API route also 404s as
 * defense in depth.
 */
export function GuestButton() {
  const { start: tryAsGuest, loading } = useGuestStart();

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
