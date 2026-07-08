import { cn } from "@/lib/utils";

/**
 * Small uppercase section heading used to group content on the Dashboard,
 * Lists, and Words screens (e.g. "STUDYING", "SPECIALIZED PRACTICE").
 * Renders an <h2> by default so it stays a real landmark for a11y/tests.
 */
export function SectionLabel({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p";
}) {
  return (
    <Tag
      className={cn(
        "mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </Tag>
  );
}
