"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Hosted-plan trial countdown, rendered app-wide above the page content.
 * Escalates as the clock runs down:
 *   14–8 days: subtle, dismissible (per-day via localStorage)
 *    7–3 days: amber, dismissible
 *    2–0 days: prominent, NOT dismissible
 * Renders nothing while access is fine on a paid plan or self-hosted
 * (the server only mounts it when status is "trialing" with a clock).
 */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 2;
  const warning = daysLeft <= 7 && !urgent;
  const dismissKey = `trial-banner-${daysLeft}`;

  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    // Dismissal holds for the current day-count only, so the banner
    // reappears as the number drops.
    setDismissed(!urgent && localStorage.getItem(dismissKey) === "1");
  }, [dismissKey, urgent]);

  if (dismissed) return null;

  const label = urgent
    ? `Trial ends in ${daysLeft === 0 ? "less than a day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}. Your progress stays saved either way.`
    : warning
      ? `${daysLeft} days left — keep your streak going for €10/mo.`
      : `${daysLeft} days left in your trial.`;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 px-4 py-2 text-sm",
        urgent
          ? "bg-destructive/10 text-destructive"
          : warning
            ? "bg-amber/10 text-amber"
            : "bg-muted text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <Link
        href="/settings#billing"
        className="font-medium underline underline-offset-2"
      >
        Upgrade
      </Link>
      {!urgent && (
        <button
          type="button"
          aria-label="Dismiss"
          className="ml-1 opacity-60 transition-opacity hover:opacity-100"
          onClick={() => {
            localStorage.setItem(dismissKey, "1");
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
