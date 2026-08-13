import { redirect } from "next/navigation";

import { LandingHero } from "@/components/landing/LandingHero";
import { LandingSections } from "@/components/landing/LandingSections";
import { getCurrentUserId } from "@/lib/session";
import { isSelfHosted } from "@/lib/selfHosted";

export default async function LandingPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    redirect("/dashboard");
  }

  // Self-hosters see the app, not the marketing pitch.
  if (isSelfHosted()) {
    redirect("/login");
  }

  return (
    <>
      <LandingHero />
      <LandingSections />
    </>
  );
}
