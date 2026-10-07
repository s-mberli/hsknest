"use client";

import { TryFreeButton } from "@/components/landing/TryFreeButton";
import { trackEvent } from "@/lib/analytics";
import { useRef } from "react";

/** Track intent while preserving the homepage's existing guest-start flow. */
export function LandingTeaserCta() {
  const tracked = useRef(false);
  return (
    <div
      onClickCapture={() => {
        if (tracked.current) return;
        tracked.current = true;
        trackEvent("promo_try_click");
      }}
    >
      <TryFreeButton>Try without signing up</TryFreeButton>
    </div>
  );
}
