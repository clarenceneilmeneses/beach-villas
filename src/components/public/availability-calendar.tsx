import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { addDays, manilaToday, niceDate, SLOT_LABEL } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { GuestSlot } from "./search-pill";

const SLOTS: GuestSlot[] = ["day", "night", "h22"];

function monthGrid(key: string) {
  const first = `${key}-01`;
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay();
  const pad = dow === 0 ? 6 : dow - 1;
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Math.round((next.getTime() - Date.parse(`${first}T00:00:00Z`)) / 864e5);
  return [...Array.from({ length: pad }, () => null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
}
const shift = (key: string, n: number) => {
  const d = new Date(`${key}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

/** Which dates still have a cottage of this type free for the chosen stay. Tap one to pick it. */
export function AvailabilityCalendar({
  typeId,
  slot,
  onSlot,
  date,
  onDate,
}: {
  typeId: string;
  slot: GuestSlot;
  onSlot: (s: GuestSlot) => void;
  date: string;
  onDate: (d: string) => void;
}) {
  const today = manilaToday();
  const [month, setMonth] = useState(date.slice(0, 7));
  const grid = monthGrid(month);
  const from = `${month}-01`;
  const to = grid.at(-1)!;
  const q = useQuery({
    queryKey: ["type-month", typeId, month],
    queryFn: () => rpc<{ on_date: string; slot: string; free: number }[]>("type_month_availability", { p_type: typeId, p_from: from, p_to: to }),
  });
  const freeOn = (d: string) => q.data?.find((r) => r.on_date === d && r.slot === slot)?.free;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1">
          {SLOTS.map((s) => (
            <button key={s} type="button" onClick={() => onSlot(s)} className={cn("rounded-full px-3 py-1.5 text-[13px]", slot === s ? "bg-secondary font-medium text-primary" : "text-muted-foreground")}>
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full" disabled={month <= today.slice(0, 7)} onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
          <span className="min-w-[8.5rem] text-center font-medium">{niceDate(from, { month: "long", year: "numeric" })}</span>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMonth(shift(month, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (!d) return <span key={`p${i}`} />;
          const past = d < today;
          const free = freeOn(d);
          const full = free === 0;
          const picked = d === date;
          return (
            <button
              key={d}
              type="button"
              disabled={past || full}
              onClick={() => onDate(d)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-full text-sm transition-colors",
                picked ? "bg-primary text-primary-foreground" : past ? "text-muted-foreground/40" : full ? "text-muted-foreground line-through" : "hover:bg-secondary",
              )}
            >
              <span className="tabular-nums">{Number(d.slice(8))}</span>
              {!past && free !== undefined && !full && (
                <span className={cn("size-1 rounded-full", picked ? "bg-primary-foreground" : free <= 1 ? "bg-warning" : "bg-success")} />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Free</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" /> Last one</span>
        <span className="line-through">12</span> Full
        {freeOn(date) !== undefined && <span className="ml-auto">{niceDate(date)}: {freeOn(date)} free</span>}
      </div>
    </div>
  );
}
