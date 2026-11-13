import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Unsubscribe | HSK Nest" };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; done?: string }>;
}) {
  const { u, t, done } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center gap-4 px-6 py-12 text-center">
      {done ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">You&apos;re unsubscribed</h1>
          <p className="text-sm text-muted-foreground">
            No more daily reminder emails. You can turn them back on in{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Settings
            </Link>
            .
          </p>
        </>
      ) : u && t ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Stop daily reminders?</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ll still get account emails like password resets.
          </p>
          <form
            method="post"
            action={`/api/unsubscribe?${new URLSearchParams({ u, t })}`}
          >
            <Button type="submit">Unsubscribe</Button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Link incomplete</h1>
          <p className="text-sm text-muted-foreground">
            Turn reminders off in{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Settings
            </Link>{" "}
            instead.
          </p>
        </>
      )}
    </main>
  );
}
