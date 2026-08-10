/**
 * Next.js global error boundary — uncaught errors in the root layout or in
 * async server components that have no local error.tsx handler. This is a
 * client component that wraps error.tsx-like behavior for the entire app.
 */

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture the error in Sentry (if configured)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error, {
          tags: {
            level: "global",
          },
        });
      });
    }
    // Also log to console for development
    console.error("Global error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex flex-1 flex-col items-center justify-center min-h-screen text-center px-4">
          <AlertCircle className="h-16 w-16 text-destructive mb-6" />
          <h2 className="text-3xl font-bold tracking-tight">Something went very wrong!</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-md">
            An unexpected error occurred. If it keeps happening, please send us
            feedback from the settings page or contact support.
          </p>
          <div className="mt-8">
            <Button onClick={() => reset()}>Try again</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
