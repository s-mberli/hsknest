import { LandingTeaserPlayer } from "@/components/landing/LandingTeaserPlayer";
import { LandingTeaserCta } from "@/components/landing/LandingTeaserCta";

/** Server-rendered introduction and guest CTA for the product tour. */
export function LandingTeaser() {
  return (
    <section
      aria-labelledby="landing-teaser-title"
      className="mx-auto w-full max-w-5xl space-y-6 px-6 pb-16 pt-12 sm:pb-20 sm:pt-16"
    >
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <h2
          id="landing-teaser-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Six ways to make Chinese words stick.
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          Follow one word from your first flashcard to Word Ninja in a
          20-second tour.
        </p>
      </div>

      <LandingTeaserPlayer />

      <div className="flex justify-center pt-1">
        <LandingTeaserCta />
      </div>
    </section>
  );
}
