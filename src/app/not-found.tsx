import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <h1 className="text-9xl font-bold tracking-tight text-muted-foreground/20">404</h1>
      <h2 className="mt-4 text-3xl font-bold tracking-tight">Page not found</h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-md">
        Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/">Go back home</Link>
        </Button>
      </div>
    </div>
  );
}
