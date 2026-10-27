import { useState } from "react";
import { CalendarDays, Home, SlidersHorizontal, X } from "@/components/icons";
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
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm hover:bg-secondary", className)}>
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="whitespace-nowrap">{range.label}</span>
          {filters.preset !== "custom" && <span className="hidden whitespace-nowrap text-muted-foreground xl:inline">· {range.span}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(320px,calc(100vw-2rem))] rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.filter((p) => p.value !== "custom").map((p) => (
            <Button
              key={p.value}
              type="button"
              size="sm"
              variant={filters.preset === p.value ? "default" : "outline"}
              className="justify-start rounded-full"
              onClick={() => { setFilters({ preset: p.value }); setOpen(false); }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="malaya-eyebrow">Or set the dates</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <Label htmlFor="flt-from" className="text-xs text-muted-foreground">From</Label>
              <Input id="flt-from" type="date" className="mt-1 h-9 px-2.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="flt-to" className="text-xs text-muted-foreground">To</Label>
              <Input id="flt-to" type="date" className="mt-1 h-9 px-2.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Button size="sm" className="mt-2 w-full rounded-full" disabled={!from || !to} onClick={() => { setFilters({ preset: "custom", from, to }); setOpen(false); }}>Apply dates</Button>
        </div>
        <div className="mt-3 border-t border-border/70 pt-3"><ClearFilters full onDone={() => setOpen(false)} /></div>
      </PopoverContent>
    </Popover>
  );
}

export function ClearFilters({ full = false, onDone }: { full?: boolean; onDone?: () => void }) {
  const { active } = useFilters();
  // Inside the menu and the sheet it is always there (greyed when nothing is set);
  // in the top pill it appears, labelled, once a filter is on.
  if (full)
    return (
      <Button variant="outline" className="w-full rounded-full" disabled={!active} onClick={() => { clearFilters(); onDone?.(); }}>
        <X className="size-4" /> Clear filters
      </Button>
    );
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" className="h-9 rounded-full px-3 text-muted-foreground hover:text-foreground" onClick={clearFilters} title="Back to all cottages, this month">
      <X className="size-4" /> Clear filters
    </Button>
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
