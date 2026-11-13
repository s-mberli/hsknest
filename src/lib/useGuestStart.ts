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
 * - The server answers `{ existing: true }` for a visitor who already has a
 *   valid session, and the button simply opens their dashboard.
 * - A ref guards against two taps in the same frame; React state alone is
 *   read stale by both.
 * - One deadline covers every stage (guest creation, sign-in, session
 *   check). When it passes, the button is released with a message and the
 *   late stages are ignored, so a timed-out attempt never navigates.
 * - On success the button stays busy through navigation.
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

    let settled = false;
    const controller = new AbortController();
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      toast.error(message);
      inFlight.current = false;
      setLoading(false);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      router.push("/dashboard");
      router.refresh();
    };
    const deadline = setTimeout(() => {
      controller.abort();
      fail("This is taking too long. Check your connection and try again.");
    }, TIMEOUT_MS);

    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        signal: controller.signal,
      });
      if (settled) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(data.error ?? "Could not start, please try again.");
        return;
      }
      if (data.existing) {
        succeed();
        return;
      }
      const login = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (settled) return;
      if (login?.error) {
        fail("Could not start, please try again.");
        return;
      }
      const session = await getSession();
      if (settled) return;
      if (!session?.user) {
        fail("Could not confirm your session. Please try again.");
        return;
      }
      succeed();
    } catch {
      fail("Could not start the guest session. Check your connection and try again.");
    }
  }

  return { start, loading };
}
