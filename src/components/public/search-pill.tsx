import { useState } from "react";
import { CalendarDays, Clock, Minus, Plus, Search, Users } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { addDays, manilaToday, niceDate, SLOT_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GuestSlot = "day" | "night" | "h22";
export type StaySearch = { date: string; slot: GuestSlot; adults: number; children: number };

export function parseStay(s: Record<string, unknown>): StaySearch {
  const date = typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : addDays(manilaToday(), 1);
  const slot = (["day", "night", "h22"].includes(String(s.slot)) ? s.slot : "day") as GuestSlot;
  const adults = Math.max(1, Number(s.adults) || 4);
  const children = Math.max(0, Number(s.children) || 0);
  return { date, slot, adults, children };
}

/** Only the stay params that are present and valid, so links needn't carry them. */
export function stayParams(s: Record<string, unknown>): Partial<StaySearch> {
  const out: Partial<StaySearch> = {};
  if (typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) out.date = s.date;
  if (["day", "night", "h22"].includes(String(s.slot))) out.slot = s.slot as GuestSlot;
  if (Number(s.adults) >= 1) out.adults = Number(s.adults);
  if (Number(s.children) >= 0 && s.children !== undefined) out.children = Number(s.children);
  return out;
}

export const withDefaults = (p: Partial<StaySearch>): StaySearch => parseStay(p as Record<string, unknown>);

const SLOTS: GuestSlot[] = ["day", "night", "h22"];

function Stepper({ label, hint, value, min, onChange }: { label: string; hint: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-full" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}><Minus className="size-4" /></Button>
        <span className="w-6 text-center tabular-nums">{value}</span>
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-full" onClick={() => onChange(value + 1)} aria-label={`More ${label}`}><Plus className="size-4" /></Button>
      </div>
    </div>
  );
}

function Fields({ v, set, stacked }: { v: StaySearch; set: (p: Partial<StaySearch>) => void; stacked?: boolean }) {
  const seg = stacked ? "rounded-2xl border border-border/70 px-4 py-3" : "flex-1 rounded-full px-5 py-2.5 hover:bg-secondary/60";
  const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground";
  return (
    <>
      <label className={cn("flex min-w-0 items-center gap-3", seg)}>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className={cn("block", eyebrow)}>Date</span>
          <input type="date" value={v.date} min={manilaToday()} onChange={(e) => set({ date: e.target.value })} className="w-full bg-transparent text-sm text-muted-foreground outline-none" />
        </span>
      </label>
      {!stacked && <span aria-hidden className="h-8 w-px bg-border" />}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cn("flex min-w-0 items-center gap-3 text-left", seg)}>
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className={cn("block", eyebrow)}>Stay</span>
              <span className="text-sm text-muted-foreground">{SLOT_LABEL[v.slot]}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 rounded-2xl p-2">
          {SLOTS.map((s) => (
            <button key={s} type="button" onClick={() => set({ slot: s })} className={cn("w-full rounded-xl px-3 py-2.5 text-left text-sm", v.slot === s ? "bg-secondary font-medium" : "hover:bg-secondary/60")}>
              {SLOT_LABEL[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {!stacked && <span aria-hidden className="h-8 w-px bg-border" />}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cn("flex min-w-0 items-center gap-3 text-left", seg)}>
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className={cn("block", eyebrow)}>Guests</span>
              <span className="text-sm text-muted-foreground">{v.adults + v.children} guests</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 rounded-2xl px-4 py-1">
          <Stepper label="Adults" hint="13 and up" value={v.adults} min={1} onChange={(n) => set({ adults: n })} />
          <div className="border-t border-border/60" />
          <Stepper label="Kids" hint="12 and under" value={v.children} min={0} onChange={(n) => set({ children: n })} />
        </PopoverContent>
      </Popover>
    </>
  );
}

/** Malaya's search pill: one white pill on a laptop, a "Start your search" pill that opens a sheet on a phone. */
export function SearchPill({ value, onSearch }: { value: StaySearch; onSearch: (v: StaySearch) => void }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  const set = (p: Partial<StaySearch>) => setV((cur) => ({ ...cur, ...p }));
  return (
    <>
      <div className="mx-auto hidden max-w-3xl items-center gap-1 rounded-full border border-border/70 bg-card p-1.5 shadow-level-3 md:flex">
        <Fields v={v} set={set} />
        <Button className="h-12 shrink-0 rounded-full px-6" onClick={() => onSearch(v)}><Search className="size-4" /> Search</Button>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-full border border-border/70 bg-card px-5 py-3.5 text-left shadow-level-2 md:hidden">
        <Search className="size-5" />
        <span>
          <span className="block font-medium">{niceDate(v.date)} · {SLOT_LABEL[v.slot]}</span>
          <span className="block text-xs text-muted-foreground">{v.adults + v.children} guests · tap to change</span>
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetTitle className="font-display text-xl">Start your search</SheetTitle>
          <div className="mt-4 grid gap-2">
            <Fields v={v} set={set} stacked />
          </div>
          <Button className="mt-4 h-12 w-full rounded-full" onClick={() => { onSearch(v); setOpen(false); }}><Search className="size-4" /> Search</Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
