import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { Segmented, SettingRow } from "./shared";

type FeedbackCategory = "bug" | "idea" | "other";

const FEEDBACK_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

/** In-app bug reports / ideas. Posts to /api/feedback (rate-limited server-side). */
export function FeedbackSection() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const tooShort = message.trim().length < 10;

  async function submit() {
    setSending(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        message: message.trim(),
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error("Could not send that — please try again.");
      return;
    }
    toast.success("Thanks — we got it.");
    setMessage("");
    setCategory("bug");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <CardDescription>
          Found a bug or have an idea? Send it straight to the maintainers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow
          name="Type"
          description="What kind of feedback is this?"
        >
          <Segmented
            label="Feedback type"
            value={category}
            disabled={sending}
            options={FEEDBACK_OPTIONS}
            onChange={setCategory}
          />
        </SettingRow>

        <div className="space-y-2">
          <Textarea
            value={message}
            disabled={sending}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened, or what would you like to see? (at least 10 characters)"
            maxLength={2000}
            rows={4}
            aria-label="Feedback message"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={sending || tooShort}
              onClick={submit}
            >
              {sending ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
