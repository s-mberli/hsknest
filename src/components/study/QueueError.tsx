"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function QueueError({ retry }: { retry: () => void }) {
  return <div role="alert" className="flex flex-col items-center gap-4 px-4 text-center">
    <h2 className="text-lg font-semibold">Could not load your session</h2>
    <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
    <Button onClick={retry}>Retry</Button>
    <Button variant="outline" asChild><Link href="/dashboard">Exit</Link></Button>
  </div>;
}
