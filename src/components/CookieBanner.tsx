"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Routes where the BottomNav is rendered (see src/app/(app)/layout.tsx) —
// on these the banner must sit above the nav instead of covering it.
const NAV_ROUTES = ["/dashboard", "/lists", "/words", "/settings"];

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  const aboveNav = NAV_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  useEffect(() => {
    // Check if the user has already consented
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "declined");
    setShow(false);
  };

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur sm:p-6",
        aboveNav ? "bottom-[3.75rem]" : "bottom-0"
      )}
    >
      <div className="container mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <p>
            We use essential cookies to keep you logged in securely. We do not use third-party tracking cookies without your consent.{" "}
            <Link href="/privacy" className="font-medium underline underline-offset-4 hover:text-primary">
              Learn more in our Privacy Policy
            </Link>.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline Non-Essential
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
