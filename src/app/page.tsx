import { redirect } from "next/navigation";

import { LandingHero } from "@/components/landing/LandingHero";
import { LandingSections } from "@/components/landing/LandingSections";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isSelfHosted } from "@/lib/selfHosted";

export default async function LandingPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    redirect("/dashboard");
  }

  // Self-hosters see the app, not the marketing pitch. On a brand-new
  // instance with zero accounts, go straight to signup — landing on /login
  // wrongly implies an account already exists.
  if (isSelfHosted()) {
    const userCount = await prisma.user.count();
    redirect(userCount === 0 ? "/signup" : "/login");
  }

  return (
    <>
      <LandingHero />
      <LandingSections />
    </>
  );
}
