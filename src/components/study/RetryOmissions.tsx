export function RetryOmissions({ count }: { count: number }) {
  if (!count) return null;
  return <p role="status" className="mx-auto mb-3 max-w-sm shrink-0 text-center text-xs text-muted-foreground">
    {count} {count === 1 ? "retry word is" : "retry words are"} no longer available in this scope. No replacement words were added.
  </p>;
}
