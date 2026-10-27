import { useState } from "react";
import { CalendarDays, Check, Home, SlidersHorizontal, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCottages, useCottageTypes } from "@/lib/data";
import { clearFilters, PRESETS, setFilters, useFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** Malaya's scope bar: "which cottages, when", one question in one pill. */
export function ScopePicker({ className }: { className?: string }) {
  const { filters } = useFilters();
  const types = useCottageTypes().data ?? [];
  const cottages = useCottages().data ?? [];
  return (
    <Select value={filters.scope} onValueChange={(v) => setFilters({ scope: v })}>
      <SelectTrigger className={cn("h-9 gap-2 rounded-full border-0 bg-transparent shadow-none hover:bg-secondary", className)} aria-label="Cottages">
        <Home className="size-4 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All cottages</SelectItem>
        {types.map((t) => (
          <SelectGroup key={t.id}>
            <SelectLabel>{t.name}</SelectLabel>
            <SelectItem value={`type:${t.id}`}>Every {t.name}</SelectItem>
            {cottages.filter((c) => c.type_id === t.id).map((c) => <SelectItem key={c.id} value={`cottage:${c.id}`}>{c.name}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DatePicker({ className }: { className?: string }) {
  const { filters, range } = useFilters();
  const [from, setFrom] = useState(filters.from || range.from);
  const [to, setTo] = useState(filters.to || range.to);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm hover:bg-secondary", className)}>
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="whitespace-nowrap">{range.label}</span>
          {filters.preset !== "custom" && <span className="hidden whitespace-nowrap text-muted-foreground xl:inline">· {range.span}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl p-2">
        {PRESETS.filter((p) => p.value !== "custom").map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setFilters({ preset: p.value })}
            className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm", filters.preset === p.value ? "bg-secondary font-medium" : "hover:bg-secondary/60")}
          >
            {p.label} {filters.preset === p.value && <Check className="size-4" />}
          </button>
        ))}
        <div className="mt-2 space-y-2 border-t border-border/60 px-1 pt-3">
          <p className="malaya-eyebrow px-2">Custom range</p>
          <div className="grid gap-2">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2"><Label className="text-xs" htmlFor="flt-from">From</Label><Input id="flt-from" type="date" className="min-w-0 px-3" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2"><Label className="text-xs" htmlFor="flt-to">To</Label><Input id="flt-to" type="date" className="min-w-0 px-3" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <Button size="sm" className="w-full" disabled={!from || !to} onClick={() => setFilters({ preset: "custom", from, to })}>Apply range</Button>
        </div>
        <button type="button" onClick={clearFilters} className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
          Clear filters · all cottages, this month
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function ClearFilters({ full = false }: { full?: boolean }) {
  const { active } = useFilters();
  // The sheet always offers it; the top pill shows the × only when something is set.
  if (full) return <Button variant="outline" className="w-full" disabled={!active} onClick={clearFilters}>Clear filters</Button>;
  if (!active) return null;
  return (
    <button type="button" onClick={clearFilters} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Clear filters">
      <X className="size-4" />
    </button>
  );
}

/** The phone's version: an icon in the top pill, the two pickers in a sheet. */
export function FilterSheet() {
  const [open, setOpen] = useState(false);
  const { active } = useFilters();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative grid size-9 place-items-center rounded-full text-foreground/75 hover:bg-secondary" aria-label={active ? "Filters (on)" : "Filters"}>
        <SlidersHorizontal className="size-[18px]" />
        {active && <span className="absolute right-1.5 top-1.5 size-2 rounded-full border border-card bg-primary" />}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[320px]">
          <SheetTitle className="font-display text-lg">What and when</SheetTitle>
          <div className="mt-5 space-y-5">
            <div>
              <p className="malaya-eyebrow mb-2">Cottages</p>
              <div className="rounded-full border border-border/70"><ScopePicker className="w-full" /></div>
            </div>
            <div>
              <p className="malaya-eyebrow mb-2">Dates</p>
              <div className="rounded-full border border-border/70"><DatePicker className="w-full justify-start" /></div>
            </div>
            <ClearFilters full />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
