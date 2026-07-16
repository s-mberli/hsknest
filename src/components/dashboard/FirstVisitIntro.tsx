"use client";

import { useEffect, useState } from "react";

import { HowItWorksModal } from "@/components/HowItWorksModal";

const SEEN_KEY = "hsknest-seen-intro";
// Pre-rename key: honored so existing users don't see the intro again.
const LEGACY_SEEN_KEY = "recall-seen-intro";

/**
 * Opens the "How it works" modal exactly once — on the first dashboard visit
 * after onboarding (which clears the flag). Purely client-side; no-op if the
 * user has already seen it.
 */
export function FirstVisitIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem(SEEN_KEY) ||
        localStorage.getItem(LEGACY_SEEN_KEY)
      )
        return;
      localStorage.setItem(SEEN_KEY, "1");
      setOpen(true);
    } catch {
      // localStorage unavailable — just skip the nudge.
    }
  }, []);

  return <HowItWorksModal open={open} onClose={() => setOpen(false)} />;
}
