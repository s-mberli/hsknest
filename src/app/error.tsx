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
    // Server-side render errors carry a digest that matches the structured
    // log line on the server — log it so users can report it from devtools.
    console.error("App error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <AlertCircle className="h-16 w-16 text-destructive mb-6" />
      <h2 className="text-3xl font-bold tracking-tight">Something went wrong!</h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-md">
        An unexpected error occurred. If it keeps happening, please send us
        feedback from the settings page.
      </p>
      <div className="mt-8">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
