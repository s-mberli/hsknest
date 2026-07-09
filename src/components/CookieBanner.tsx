"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
  const [show, setShow] = useState(false);

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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur sm:p-6">
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
