import {
  AudioLines,
  BookOpenCheck,
  Check,
  GitBranch,
  Timer,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TryFreeButton } from "@/components/landing/TryFreeButton";
import { Button } from "@/components/ui/button";

const GITHUB_URL = "https://github.com/s-mberli/hsknest";

const HSK_LEVEL_PILLS = [
  { label: "HSK 1", words: "~500 words" },
  { label: "HSK 9", words: "11,000+ words total" },
];

const SAMPLE_SENTENCE = {
  hanzi: "我每天都在学习中文。",
  pinyin: "wǒ měi tiān dōu zài xué xí zhōng wén.",
  translation: "I study Chinese every day.",
};


const STEPS = [
  {
    n: "1",
    title: "Jump in as a guest",
    body: "No signup, no card — you're studying in ten seconds.",
  },
  {
    n: "2",
    title: "Pick a deck",
    body: "Tell us your HSK level and the right deck is waiting — or import your own lists.",
  },
  {
    n: "3",
    title: "Review daily",
    body: "HSK Nest tells you exactly what to study and when. Optimized by FSRS to minimize your daily review load, keeping your streak alive over years of fluency, not just weeks of cramming.",
  },
];

const FAQ = [
  {
    q: "Is HSK Nest really free?",
    a: "Self-hosted, yes — forever, under the AGPL license. The hosted version is €10/month after a 14-day free trial: we handle updates, backups, and hosting.",
  },
  {
    q: "Do I need a credit card to try it?",
    a: "No. Start in guest mode instantly, and the 14-day trial never asks for a card — so there's no surprise charge, ever.",
  },
  {
    q: "Can I import my existing Anki decks?",
    a: "Yes — export them from Anki as CSV/TSV and paste or upload; you map the columns and HSK Nest does the rest.",
  },
  {
    q: "What languages does HSK Nest support?",
    a: "HSK Nest is built for Mandarin: full HSK 1–9 (the 2021 standard) plus 3,000 example sentences with pinyin. The engine underneath is language-agnostic, so you can import your own CSV decks for anything else you're memorizing.",
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
  {
    src: "/screenshots/study.png",
    alt: "Studying a flashcard with pinyin, meaning, and example sentence",
    caption: "Study",
  },
  {
    src: "/screenshots/words.png",
    alt: "Words overview with per-word strength",
    caption: "Words",
  },
  {
    src: "/screenshots/lists.png",
    alt: "Word lists including all HSK levels",
    caption: "Lists",
  },
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
          apps that stop halfway through the HSK levels. HSK Nest starts you
          with everything already in place — so all that&apos;s left is the
          studying.
        </p>
      </section>

      {/* Value stack — asymmetric bento */}
      <section className="space-y-8">
        <div className="space-y-1.5 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to master vocabulary.
          </h2>
          <p className="text-sm text-muted-foreground">Zero configuration required.</p>
        </div>

        {/* Row 1: wide left (Every HSK Word + pills) + narrow right (Pronunciation) */}
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:col-span-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <BookOpenCheck className="size-5 text-primary" />
            </span>
            <h3 className="font-semibold">Every HSK Word, Curated</h3>
            <p className="text-sm text-muted-foreground">
              From absolute beginner to mastery. The complete HSK 1–9 vocabulary
              list, meticulously tagged, categorized, and error-checked.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {HSK_LEVEL_PILLS.map((pill, i) => (
                <span key={pill.label} className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {pill.label}: {pill.words}
                  </span>
                  {i < HSK_LEVEL_PILLS.length - 1 && (
                    <span aria-hidden="true" className="text-muted-foreground/50">···</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:col-span-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <AudioLines className="size-5 text-primary" />
            </span>
            <h3 className="font-semibold">Native Audio</h3>
            <p className="text-sm text-muted-foreground">
              Crystal clear pronunciation for every character and word.
            </p>
          </div>
        </div>

        {/* Row 2: FSRS left + 3000 sentences middle + sentence example right */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:min-h-[220px]">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Timer className="size-5 text-primary" />
            </span>
            <h3 className="font-semibold">FSRS Scheduling</h3>
            <p className="text-sm text-muted-foreground">
              State-of-the-art spaced repetition algorithm minimizes review time
              while maximizing retention.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:min-h-[220px]">
            <p className="text-4xl font-bold text-primary/80">99</p>
            <h3 className="font-semibold">3,000+ Context Sentences</h3>
            <p className="text-sm text-muted-foreground">
              Don&apos;t learn words in a vacuum. Understand nuance with
              high-quality, practical example sentences.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-2 rounded-2xl border bg-primary/5 p-6 sm:min-h-[220px]">
            <p className="text-lg font-medium">
              {SAMPLE_SENTENCE.hanzi.split("").map((char, i) => (
                <span key={i} className={/[一-鿿]/.test(char) && i >= 4 && i <= 5 ? "text-primary" : ""}>
                  {char}
                </span>
              ))}
            </p>
            <p className="text-sm text-muted-foreground">{SAMPLE_SENTENCE.pinyin}</p>
            <p className="text-sm text-muted-foreground">{SAMPLE_SENTENCE.translation}</p>
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Study without the clutter
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {SHOTS.map(({ src, alt, caption }) => (
            <figure
              key={src}
              className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card"
            >
              <div className="aspect-video overflow-hidden bg-muted/30">
                <Image
                  src={src}
                  alt={alt}
                  width={1280}
                  height={1600}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <figcaption className="border-t px-4 py-2.5 text-sm text-muted-foreground">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <div className="relative grid gap-8 sm:grid-cols-3 sm:gap-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-5 hidden border-t border-border/60 sm:block"
          />
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="relative space-y-2 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-full border border-primary/20 bg-background text-2xl font-bold text-primary">
                {n}
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open source trust */}
      <section className="mx-auto max-w-2xl space-y-4 border-y py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Self-host it forever, free
        </h2>
        <p className="text-muted-foreground">
          HSK Nest is AGPL open source. Run it on your own server with zero
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
      <section id="pricing" className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Simple pricing, no lock-in
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Same exact software. We just handle the servers, backups, and audio
            pipeline so you don&apos;t have to.
          </p>
        </div>

        <div className="mx-auto max-w-3xl text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
            <span>🔥</span> Founder&apos;s Rate: Limited to the first 50 users.
          </div>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Lock in this price forever. As we add features, the public price will increase to €15/month, but early adopters keep this rate for life.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl items-start gap-8 pt-6 md:grid-cols-2">
          {/* Monthly Card */}
          <div className="flex flex-col h-full rounded-3xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Monthly
              </p>
              <p className="mt-2 text-5xl font-extrabold tracking-tight">
                €10
                <span className="text-lg font-medium text-muted-foreground">
                  /month
                </span>
              </p>
            </div>
            <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground flex-grow">
              {[
                "14 days free (no credit card to start)",
                "All features & pre-loaded HSK decks",
                "Cancel anytime, in one click",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <TryFreeButton className="w-full">
                Start your free trial
              </TryFreeButton>
            </div>
          </div>

          {/* Yearly Card */}
          <div className="relative flex flex-col h-full rounded-3xl border-2 border-primary bg-card p-8 shadow-card">
            <div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-foreground">
              Best Value
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-primary">
                Yearly
              </p>
              <p className="mt-2 text-5xl font-extrabold tracking-tight">
                €99
                <span className="text-lg font-medium text-muted-foreground">
                  /year
                </span>
              </p>
            </div>
            <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground flex-grow">
              {[
                "Two months free",
                "14 days free (no credit card to start)",
                "All features & pre-loaded HSK decks",
                "14-day no-questions-asked refund",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className={line === "Two months free" ? "font-medium text-foreground" : ""}>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <TryFreeButton className="w-full">
                Start your free trial
              </TryFreeButton>
            </div>
          </div>
        </div>
        
        <p className="text-center text-sm text-muted-foreground pt-4">
          Prefer to run it yourself?{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Self-host free on GitHub
          </a>{" "}
          ·{" "}
          <Link
            href="/pricing"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Compare options
          </Link>
        </p>
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

      {/* Footer — 3 columns */}
      <footer className="border-t pt-10 text-sm text-muted-foreground">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Product
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link href="/dashboard" className="hover:text-foreground">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/lists" className="hover:text-foreground">
                  Lists
                </Link>
              </li>
              <li>
                <Link href="/words" className="hover:text-foreground">
                  Words
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Legal
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/credits" className="hover:text-foreground">
                  Data Credits
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Open source
            </p>
            <ul className="space-y-1.5">
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_URL}#deploy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Self-host guide
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
