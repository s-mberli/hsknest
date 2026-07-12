import { cn } from "@/lib/utils";

/**
 * Segmented pill control — a `rounded-full bg-muted p-1` track with a raised
 * active button. Plain
 * buttons with `aria-pressed`, no Radix radios.
 */
export function Segmented<T extends string | number | null>({
  value,
  options,
  disabled,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-grid grid-flow-col auto-cols-fr gap-1 rounded-full bg-muted p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One settings row: label + one-line description on the left, control on the
 * right. Stacks (label above control) below `sm:`.
 */
export function SettingRow({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-none">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
