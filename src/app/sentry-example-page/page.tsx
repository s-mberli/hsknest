"use client";

/**
 * Sentry verification only — not linked from the app, visit directly at
 * /sentry-example-page. Click the button to throw a client-side error and
 * fire a server-side one via /api/sentry-example-api, then check the Sentry
 * dashboard's Issues tab. Safe to delete both files once confirmed working.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SentryExamplePage() {
  const [hasSent, setHasSent] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-3xl font-bold tracking-tight">Sentry verification page</h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-md">
        Not linked from the app. Click the button to trigger a client-side
        error and a server-side error, then check the Issues tab at
        sentry.io. Delete this page once confirmed.
      </p>
      <div className="mt-8">
        <Button
          onClick={async () => {
            setHasSent(true);
            // Fire the server-side test first (fetch failure is expected —
            // the route intentionally throws a 500).
            await fetch("/api/sentry-example-api").catch(() => {});
            // Then throw client-side.
            throw new Error("Sentry Example Frontend Error");
          }}
        >
          Throw test error
        </Button>
        {hasSent && (
          <p className="mt-4 text-sm text-muted-foreground">
            Sent. Check sentry.io → Issues for two new errors.
          </p>
        )}
      </div>
    </div>
  );
}
