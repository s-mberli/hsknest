"use client";

import { Button } from "@/components/ui/button";
import { useGuestStart } from "@/lib/useGuestStart";
import { cn } from "@/lib/utils";

/**
 * Primary landing CTA: starts a guest session instantly — no signup form,
 * no card. Same flow as the login page's GuestButton, styled as a hero CTA.
 */
export function TryFreeButton({
  className,
  children = "Try without signing up",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { start, loading } = useGuestStart();

  return (
    <Button
      size="lg"
      disabled={loading}
      onClick={start}
      className={cn(
        "h-14 rounded-full px-8 text-base transition-all hover:scale-105 hover:shadow-[0_0_2rem_-0.5rem_#3b82f6]",
        className
      )}
    >
      {loading ? "Setting things up…" : children}
    </Button>
  );
}
