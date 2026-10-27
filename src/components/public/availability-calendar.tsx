import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { slotTimes, useSettings } from "@/lib/data";
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

/**
 * Date first, then the stay. The month only says whether a date has room at
 * all; picking a date lists its three stays with their times and what is
 * free, so the guest never has to reason about halves of a day.
 */
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
  const settings = useSettings().data;
  const [month, setMonth] = useState(date.slice(0, 7));
  const grid = monthGrid(month);
  const from = `${month}-01`;
  const to = grid.at(-1)!;
  const q = useQuery({
    queryKey: ["type-month", typeId, month],
    queryFn: () => rpc<{ on_date: string; slot: string; free: number }[]>("type_month_availability", { p_type: typeId, p_from: from, p_to: to }),
  });
  const free = (d: string, s: GuestSlot) => q.data?.find((r) => r.on_date === d && r.slot === s)?.free;
  const dayState = (d: string) => {
    if (!q.data) return "unknown";
    const counts = SLOTS.map((s) => free(d, s) ?? 0);
    if (counts.every((c) => c === 0)) return "full";
    if (counts.some((c) => c === 0)) return "some";
    return "open";
  };
  const picked = SLOTS.map((s) => ({ s, n: free(date, s) }));

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" disabled={month <= today.slice(0, 7)} onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
        <span className="font-medium">{niceDate(from, { month: "long", year: "numeric" })}</span>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMonth(shift(month, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (!d) return <span key={`p${i}`} />;
          const past = d < today;
          const st = dayState(d);
          const isPicked = d === date;
          return (
            <button
              key={d}
              type="button"
              disabled={past || st === "full"}
              onClick={() => onDate(d)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-full text-sm transition-colors",
                isPicked ? "bg-primary text-primary-foreground" : past ? "text-muted-foreground/40" : st === "full" ? "text-muted-foreground line-through" : "hover:bg-secondary",
              )}
            >
              <span className="tabular-nums">{Number(d.slice(8))}</span>
              {!past && (st === "open" || st === "some") && <span className={cn("size-1 rounded-full", isPicked ? "bg-primary-foreground" : st === "open" ? "bg-success" : "bg-warning")} />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> All stays open</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" /> Some stays full</span>
        <span><span className="line-through">12</span> Fully booked</span>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <p className="text-sm font-medium">{niceDate(date, { weekday: "long", month: "long", day: "numeric" })}</p>
        {picked.map(({ s, n }) => {
          const full = n === 0;
          return (
            <button
              key={s}
              type="button"
              disabled={full}
              onClick={() => onSlot(s)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                slot === s && !full ? "border-primary bg-primary/[0.04]" : "border-border/70 hover:bg-secondary/50",
                full && "opacity-50",
              )}
            >
              <span>
                <span className="block font-medium">{SLOT_LABEL[s]}</span>
                <span className="block text-xs text-muted-foreground">{slotTimes(settings, s)}</span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                {n === undefined ? "…" : full ? "Full" : `${n} free`}
                {slot === s && !full && <Check className="size-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
