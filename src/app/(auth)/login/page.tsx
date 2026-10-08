import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { isGuestModeEnabled } from "@/lib/registration";

export default function LoginPage() {
  const guestEnabled = isGuestModeEnabled();

  return (
    <Suspense fallback={
      <main aria-busy="true" className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p role="status" className="text-sm text-muted-foreground">Loading login...</p>
        </div>
      </main>
    }>
      <LoginForm guestEnabled={guestEnabled} />
    </Suspense>
  );
}
