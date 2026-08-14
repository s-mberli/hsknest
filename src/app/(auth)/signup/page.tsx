import Link from "next/link";

import { SignupForm } from "@/components/auth/SignupForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isRegistrationOpen, isGuestModeEnabled } from "@/lib/registration";
import { isSelfHosted } from "@/lib/selfHosted";

// Reads the current user count on every request — must never be statically
// prerendered (which would bake in whatever DB state existed at build time
// and could serve a stale "open"/"closed" verdict to every visitor).
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const open = await isRegistrationOpen();

  if (!open) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Registration is closed</CardTitle>
            <CardDescription>This instance is already set up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An account already claimed this instance. If that&apos;s you,{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                sign in
              </Link>
              .
            </p>
            <p className="text-sm text-muted-foreground">
              Forgot your password?{" "}
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                Reset it
              </Link>
              .
            </p>
            <p className="text-xs text-muted-foreground">
              Instance owner? Set <code>ALLOW_REGISTRATION=true</code> to allow
              more accounts.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <SignupForm
      guestEnabled={isGuestModeEnabled()}
      selfHosted={isSelfHosted()}
    />
  );
}
