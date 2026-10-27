/**
 * A list page's search box, as a pill (2026-10-20) — the same height and
 * corners as the chip group and the filter pills beside it in the toolbar.
 *
 * It keeps a FIELD's edge (--input, 3:1) rather than the soft one buttons and
 * filter pills have: it is somewhere to type, and the edge is what says so.
 * `min-w` keeps it readable beside the chips; the owner, 2026-10-18, on the
 * Reservations search squeezed beside four filters: "Mae A. Villafuerte"
 * showed as "ifuerte".
 */
import { Search } from "@/components/icons";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchPill({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** For a screen reader, when the placeholder alone would not say it. */
  label?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative min-w-0 sm:min-w-[20rem]", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-10 rounded-full bg-card pl-10 pr-4 shadow-level-1"
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
