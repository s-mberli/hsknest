import { cn } from "@/lib/utils";

/** A sentence with every occurrence of the studied term highlighted. */
export function HighlightedSentence({
  text,
  term,
  className,
}: {
  text: string;
  term: string;
  className?: string;
}) {
  const parts = term.length > 0 ? text.split(term) : [text];
  return (
    <p
      className={cn(
        "max-w-full break-words font-semibold leading-snug tracking-tight",
        className
      )}
    >
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="rounded-md bg-primary/15 px-1 text-primary">
              {term}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
