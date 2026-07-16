import {
  AudioLines,
  BookOpenCheck,
  Check,
  Download,
  GitBranch,
  Import,
  Layers,
  MessageSquareText,
  Timer,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TryFreeButton } from "@/components/landing/TryFreeButton";
import { Button } from "@/components/ui/button";

const GITHUB_URL = "https://github.com/s-mberli/recall";

const STACK = [
  {
    icon: BookOpenCheck,
    title: "Every HSK word, ready to study",
    body: "HSK 1–9 and top-frequency decks are pre-loaded — no deck building, no downloads.",
  },
  {
    icon: MessageSquareText,
    title: "3,000 real example sentences",
    body: "See each word in context with pinyin and translation, not as an isolated flashcard.",
  },
  {
    icon: AudioLines,
    title: "Pronunciation built in",
    body: "Hear every word and sentence spoken — auto-plays as you reveal the reading.",
  },
  {
    icon: Layers,
    title: "Five ways to review",
    body: "Flashcards, meaning quiz, reading quiz, word match, and sentence practice keep it fresh.",
  },
  {
    icon: Timer,
    title: "Reviews at the right moment",
    body: "A research-backed schedule brings each word back just before you'd forget it.",
  },
  {
    icon: Import,
    title: "Bring your Anki decks",
    body: "Import via CSV/TSV export with column mapping, in under a minute.",
  },
  {
    icon: Download,
    title: "Your data stays yours",
    body: "Full CSV export of your progress, anytime — no lock-in.",
  },
  {
    icon: GitBranch,
    title: "Fully open source",
    body: "The entire codebase is public. Audit it, contribute, or run your own.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Jump in as a guest",
    body: "No signup, no card — you're studying in ten seconds.",
  },
  {
    n: "2",
    title: "Pick a deck",
    body: "HSK level, frequency list, German or Spanish starters — or import your own.",
  },
  {
    n: "3",
    title: "Review daily",
    body: "Recall tells you exactly what to study and when. A few minutes a day is enough.",
  },
];

const FAQ = [
  {
    q: "Is Recall really free?",
    a: "Self-hosted, yes — forever, under the AGPL license. The hosted version is €5/month after a 14-day free trial: we handle updates, backups, and hosting.",
  },
  {
    q: "Do I need a credit card to try it?",
    a: "No. Start in guest mode instantly, and the 14-day trial never asks for a card — so there's no surprise charge, ever.",
  },
  {
    q: "Can I import my existing Anki decks?",
    a: "Yes — export them from Anki as CSV/TSV and paste or upload; you map the columns and Recall does the rest.",
  },
  {
    q: "What languages does Recall support?",
    a: "Mandarin is the flagship: full HSK 1–9 plus 3,000 example sentences with pinyin. German and Spanish starter decks are included, and you can create decks for any language.",
  },
  {
    q: "What happens to my progress if I stop paying?",
    a: "Nothing is deleted. You can export your full progress as CSV at any time, and self-hosting is always free — your data isn't locked in.",
  },
  {
    q: "Is my data private?",
    a: "Yes. No ad tracking, no analytics cookies, open-source code you can audit — and if you want full control, run it on your own server.",
  },
];

const SHOTS = [
  { src: "/screenshots/study.png", alt: "Studying a flashcard with pinyin, meaning, and an example sentence" },
  { src: "/screenshots/dashboard.png", alt: "Dashboard with today's review queue and forecast" },
  { src: "/screenshots/words.png", alt: "Words overview with per-word strength" },
  { src: "/screenshots/lists.png", alt: "Word lists including all HSK levels" },
];

/**
 * Static marketing sections below the hero. Server-rendered; the only
 * client islands are the TryFreeButton CTAs.
 */
export function LandingSections() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-24 px-6 pb-24">
      {/* Problem */}
      <section className="mx-auto max-w-2xl space-y-3 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Building flashcard decks is the part where everyone quits
        </h2>
        <p className="text-lg text-muted-foreground">
          Hours of setup before the first review, words with no context, and
          apps that stop halfway through the HSK levels. Recall starts you
          with everything already in place — so all that&apos;s left is the
          studying.
        </p>
      </section>

      {/* Value stack */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Everything you need to master vocabulary
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {STACK.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border bg-card p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Study without the clutter
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SHOTS.map(({ src, alt }) => (
            <div
              key={src}
              className="overflow-hidden rounded-2xl border bg-card shadow-card"
            >
              <Image
                src={src}
                alt={alt}
                width={1280}
                height={800}
                className="h-auto w-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="space-y-2 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {n}
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open source trust */}
      <section className="mx-auto max-w-2xl space-y-4 rounded-3xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Self-host it forever, free
        </h2>
        <p className="text-muted-foreground">
          Recall is AGPL open source. Run it on your own server with zero
          limits and zero subscription — or let us handle hosting, updates,
          and backups for you.
        </p>
        <Button asChild variant="outline" className="rounded-full">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <GitBranch className="size-4" />
            View on GitHub
          </a>
        </Button>
      </section>

      {/* Pricing */}
      <section id="pricing" className="space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Simple pricing, no lock-in
        </h2>
        <div className="mx-auto max-w-sm rounded-3xl border-2 border-primary/30 bg-card p-8 text-center shadow-card">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recall Hosted
          </p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight">
            €5
            <span className="text-lg font-medium text-muted-foreground">
              /month
            </span>
          </p>
          <ul className="mt-6 space-y-2 text-left text-sm">
            {[
              "14 days free — no credit card to start",
              "All features and decks included",
              "Cancel anytime, in one click",
              "14-day no-questions refund",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <TryFreeButton className="w-full">
              Start your free trial
            </TryFreeButton>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Prefer to run it yourself?{" "}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Self-host free on GitHub
            </a>{" "}
            · <Link href="/pricing" className="underline underline-offset-2 hover:text-foreground">Compare options</Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl space-y-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Questions, answered
        </h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border bg-card px-5 py-4"
            >
              <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                {q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="space-y-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Stop forgetting the words you already learned
        </h2>
        <p className="text-lg text-muted-foreground">
          Start free — no card, no signup required to try.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <TryFreeButton />
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 rounded-full px-8 text-base"
          >
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              Self-host on GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t pt-8 text-center text-xs text-muted-foreground">
        <p>
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-foreground">
            Pricing
          </Link>{" "}
          ·{" "}
          <Link href="/credits" className="underline underline-offset-2 hover:text-foreground">
            Data Credits
          </Link>{" "}
          ·{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
