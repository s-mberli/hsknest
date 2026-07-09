"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <AlertCircle className="h-16 w-16 text-destructive mb-6" />
      <h2 className="text-3xl font-bold tracking-tight">Something went wrong!</h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-md">
        An unexpected error occurred. Our team has been notified.
      </p>
      <div className="mt-8">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
