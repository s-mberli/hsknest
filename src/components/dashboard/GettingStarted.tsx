import Link from "next/link";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Pick a starter list",
    body: (
      <>
        Browse the{" "}
        <Link href="/lists" className="font-medium text-primary hover:underline">
          word lists
        </Link>{" "}
        or create your own.
      </>
    ),
  },
  {
    title: "Add words to your queue",
    body: "Open a list and enroll the words you want to learn.",
  },
  {
    title: "Start studying",
    body: "A Start button appears here once you have cards queued.",
  },
];

/** First-run checklist shown until the user enrolls their first word. */
export function GettingStarted() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>Three steps to your first review.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Button asChild>
            <Link href="/lists">Browse word lists</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
