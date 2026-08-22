"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { GuestButton } from "@/components/auth/GuestButton";
import { Button } from "@/components/ui/button";
import { confirmSession } from "@/lib/authClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ guestEnabled }: { guestEnabled: boolean }) {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const verifyStatus = searchParams.get("verify"); // "success" | "error" | null
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      toast.error("Invalid email or password");
      return;
    }
    await confirmSession();
    window.location.href = "/dashboard";
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to keep your streak going.</CardDescription>
        </CardHeader>
        <CardContent>
          {resetSuccess && (
            <div className="mb-4 rounded-md bg-green-500/10 p-4 text-center text-sm font-medium text-green-600 dark:text-green-500">
              Password updated successfully! Please sign in with your new password.
            </div>
          )}
          {verifyStatus === "success" && (
            <div className="mb-4 rounded-md bg-green-500/10 p-4 text-center text-sm font-medium text-green-600 dark:text-green-500">
              Email verified — thanks!
            </div>
          )}
          {verifyStatus === "error" && (
            <div className="mb-4 rounded-md bg-destructive/10 p-4 text-center text-sm font-medium text-destructive">
              That verification link is invalid or expired. You can resend one from your dashboard.
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
          {guestEnabled && <GuestButton />}
        </CardContent>
      </Card>
    </main>
  );
}
