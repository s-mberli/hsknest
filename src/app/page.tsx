import { redirect } from "next/navigation";

import { LandingHero } from "@/components/landing/LandingHero";
import { getCurrentUserId } from "@/lib/session";

export default async function LandingPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    redirect("/dashboard");
  }

  return <LandingHero />;
}
