"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary landing CTA: starts a guest session instantly — no signup form,
 * no card. Same flow as the login page's GuestButton, styled as a hero CTA.
 */
export function TryFreeButton({
  className,
  children = "Try it free",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not start — please try again.");
        return;
      }
      const { email, password } = await res.json();
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) {
        toast.error("Could not start — please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="lg"
      disabled={loading}
      onClick={start}
      className={cn(
        "h-14 rounded-full px-8 text-base transition-all hover:scale-105 hover:shadow-[0_0_2rem_-0.5rem_#3b82f6]",
        className
      )}
    >
      {loading ? "Setting things up…" : children}
    </Button>
  );
}
