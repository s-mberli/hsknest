import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { UpgradeBanner } from "@/components/auth/UpgradeBanner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SettingRow } from "./shared";

/** Export + destructive reset + account. Reset uses a two-step confirm. */
export function AccountSection({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const router = useRouter();
  const isGuest = email.endsWith("@guest.local");
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "busy">("idle");

  async function deleteAccount() {
    setDeleting("busy");
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setDeleting("idle");
      toast.error("Could not delete the account.");
      return;
    }
    await signOut({ callbackUrl: "/signup" });
  }

  async function reset() {
    setResetting(true);
    const res = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "progress" }),
    });
    setResetting(false);
    setConfirming(false);
    if (!res.ok) {
      toast.error("Could not reset your progress.");
      return;
    }
    toast.success("All progress has been reset.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data &amp; account</CardTitle>
        <CardDescription>Export, reset, and sign out.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow
          name="Export data"
          description="Download every word and its progress as a CSV file."
        >
          <Button asChild variant="outline" size="sm">
            <a href="/api/account/export">Export CSV</a>
          </Button>
        </SettingRow>

        <SettingRow
          name="Reset progress"
          description="Wipe all progress and review history. This cannot be undone."
        >
          {confirming ? (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={reset}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Yes, reset everything"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirming(true)}
            >
              Reset progress
            </Button>
          )}
        </SettingRow>

        {isGuest && <UpgradeBanner compact />}

        <SettingRow
          name="Signed in as"
          description={name ? `${email} · ${name}` : email}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </SettingRow>

        {!isGuest && (
        <SettingRow
          name="Delete account"
          description="Permanently delete your account, lists, words, and history."
        >
          {deleting !== "idle" ? (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleting("idle")}
                disabled={deleting === "busy"}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAccount}
                disabled={deleting === "busy"}
              >
                {deleting === "busy" ? "Deleting…" : "Yes, delete everything"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setDeleting("confirm")}
            >
              Delete account
            </Button>
          )}
        </SettingRow>
        )}
      </CardContent>
    </Card>
  );
}
