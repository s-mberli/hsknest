"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { trackEvent } from "@/lib/analytics";

const TIMEOUT_MS = 15_000;

/**
 * Shared guest-start flow for every "try it" button: creates a throwaway
 * account server-side, signs in, and opens the dashboard.
 *
 * - Someone already signed in (a guest returning to /pricing or /login) is
 *   sent to the dashboard instead. Creating a second guest would replace
 *   their session and lose the first guest's progress for good.
 * - A ref guards against two taps in the same frame; React state alone is
 *   read stale by both.
 * - On success the button stays busy through navigation; it is released
 *   only on failure.
 */
export function useGuestStart() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    trackEvent("guest_start_click");

    const fail = (message: string) => {
      toast.error(message);
      inFlight.current = false;
      setLoading(false);
    };

    const existing = await getSession().catch(() => null);
    if (existing?.user) {
      router.push("/dashboard");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
      const login = await signIn("credentials", { email, password, redirect: false });
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

  return { start, loading };
}
