/**
 * A row of filter chips — "Active 96 · Unverified 6 · Cancelled 51 · All" —
 * as ONE pill, the way the top bars group their controls (2026-10-20).
 *
 * WHY ONE COMPONENT. Reservations, Team, Affiliates and Content each drew
 * their own chips: a solid brown button for the picked one, outlined buttons
 * for the rest, four slightly different class strings. Now they share this,
 * and it follows the admin's rules: a white, lifted, fully rounded strip, the
 * picked chip a soft fill like the phone's open tab, a count beside each label
 * (amber when it is something waiting on somebody).
 *
 * Still plainly buttons — the reason the chips exist (Clarence, 2026-10-01:
 * underlined text tabs "did not read as clickable"). Each is a <button> with
 * aria-pressed, inside a labelled group; the row scrolls sideways on a phone
 * rather than wrapping into a second pill.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The strip the chips sit in. Exported for a row that mixes chips with a menu (the Inbox). */
export const CHIP_STRIP =
  "inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1";
/** One chip; add CHIP_ON or CHIP_OFF. */
export const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const CHIP_ON = "bg-secondary font-medium text-primary";
export const CHIP_OFF = "text-muted-foreground hover:bg-secondary/60 hover:text-foreground";

export interface Chip<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown beside the label; nothing when absent. */
  count?: number | undefined;
  /** Amber count while it is above zero: something waiting on a person. */
  waiting?: boolean | undefined;
}

export function ChipGroup<T extends string>({
  value,
  onChange,
  chips,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  chips: Chip<T>[];
  /** What the chips filter, for a screen reader — "Reservation status". */
  label: string;
  className?: string | undefined;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("max-w-full overflow-x-auto no-scrollbar", className)}
    >
      <div className={CHIP_STRIP}>
        {chips.map((chip) => {
          const selected = chip.value === value;
          const amber = chip.waiting && (chip.count ?? 0) > 0;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(chip.value)}
              className={cn(CHIP, selected ? CHIP_ON : CHIP_OFF)}
            >
              {chip.label}
              {chip.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
                    amber
                      ? "bg-warning/15 text-warning"
                      : selected
                        ? "bg-card text-primary"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {chip.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
