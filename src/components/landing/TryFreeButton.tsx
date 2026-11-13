"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Synchronous guard: two taps in the same frame both still read the old
  // `loading` state, so state alone cannot stop a second guest account.
  const inFlight = useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    trackEvent("guest_start_click");
    // Re-enable the button only on failure. On success it stays disabled
    // through the navigation, so a second tap on a slow phone cannot create
    // a second guest account.
    const fail = (message: string) => {
      toast.error(message);
      inFlight.current = false;
      setLoading(false);
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fail(data.error ?? "Could not start, please try again.");
        return;
      }
      const { email, password } = await res.json();
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) {
        fail("Could not start, please try again.");
        return;
      }
      const session = await getSession();
      if (!session?.user) {
        fail("Could not confirm your session. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      fail("Could not start the guest session. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }
  }

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
