import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, ChevronLeft, ChevronRight, Clock, Settings2 } from "@/components/icons";
import { byCottage, HALF_STYLE, halfState, Legend, type BoardHalf } from "@/components/obs/board";
import { StatusPill } from "@/components/obs/booking-bits";
import { useBookingDialog } from "@/components/obs/booking-dialog";
import { SectionHeading } from "@/components/obs/cards";
import { ChipGroup } from "@/components/obs/chip-group";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { PhotoTile } from "@/components/public/chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStaff } from "@/lib/auth";
import { useCottages, useCottageTypes, useSettings, type Settings } from "@/lib/data";
import { scopedCottages, useFilters } from "@/lib/filters";
import { addDays, manilaToday, niceDate, niceTime, php, SLOT_LABEL, type Slot } from "@/lib/format";
import { rpc, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/calendar")({ component: Calendar });

type View = "month" | "week";

function Calendar() {
  const [view, setView] = useState<View>("month");
  const owner = useStaff().data?.role === "owner";
  const booking = useBookingDialog();
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Calendar"
        title={view === "month" ? "One cottage, the whole month" : "Every cottage, day and night"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ChipGroup label="View" value={view} onChange={setView} chips={[{ value: "month", label: "Month" }, { value: "week", label: "All cottages" }]} />
            <Button variant="outline" onClick={() => booking.open({ date: manilaToday(), mode: "block" })}>Block a slot</Button>
            {owner && (
              <Button variant="outline" asChild>
                <Link to="/admin/settings/cottages"><Settings2 className="size-4" /> Rates & pax</Link>
              </Button>
            )}
          </div>
        }
      />
      {view === "month" ? <MonthView /> : <WeekGrid />}
    </div>
  );
}

// ------------------------------------------------------------- month view

type CalBooking = {
  id: string;
  code: string;
  slot: Slot;
  status: string;
  starts_at: string;
  ends_at: string;
  hold_until: string | null;
  checked_out_at: string | null;
  block_reason: string | null;
  pax_adults: number;
  pax_children: number;
  guests: { name: string } | null;
};

const LIVE = ["pending", "confirmed", "checked_in", "settled", "blocked"];

/** The day or night half of a date as a time range, from the owner's slot times (Manila). */
function halfRange(s: Settings, date: string, half: "day" | "night"): [number, number] {
  const at = (d: string, t: string) => Date.parse(`${d}T${t.slice(0, 5)}:00+08:00`);
  return half === "day" ? [at(date, s.day_start), at(date, s.day_end)] : [at(date, s.night_start), at(addDays(date, 1), s.night_end)];
}

function occupant(list: CalBooking[], s: Settings, date: string, half: "day" | "night") {
  const [a, b] = halfRange(s, date, half);
  const now = Date.now();
  return list.find(
    (x) =>
      LIVE.includes(x.status) &&
      !(x.status === "pending" && x.hold_until && Date.parse(x.hold_until) < now) &&
      Date.parse(x.starts_at) < b &&
      Date.parse(x.ends_at) > a,
  );
}

function monthGrid(monthKey: string) {
  const first = `${monthKey}-01`;
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay();
  const pad = dow === 0 ? 6 : dow - 1; // Monday first
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Math.round((next.getTime() - Date.parse(`${first}T00:00:00Z`)) / 864e5);
  return [...Array.from({ length: pad }, () => null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
}

const shiftMonth = (key: string, n: number) => {
  const d = new Date(`${key}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

/** The fill for a booked half: pending amber, in house green, blocked grey, booked ink. */
const tone = (b: CalBooking) =>
  b.status === "blocked"
    ? "bg-muted text-muted-foreground line-through"
    : b.status === "pending"
      ? "bg-warning/25 text-foreground"
      : b.status === "checked_in" && !b.checked_out_at
        ? "bg-success/20 text-foreground"
        : "bg-foreground text-background";

/** One stay over both halves is drawn as one block, not two chips that read as two guests. */
function tileBlocks(halves: { h: "day" | "night"; b: CalBooking | undefined }[]) {
  const [day, night] = [halves[0]!.b, halves[1]!.b];
  if (day && night && day.id === night.id) return [{ key: "both", b: day, half: null as "day" | "night" | null }];
  return halves.map(({ h, b }) => ({ key: h, b, half: h as "day" | "night" | null }));
}

const compact = (n: number) => (n >= 1000 ? `₱${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : `₱${n}`);

function MonthView() {
  const today = manilaToday();
  const settings = useSettings().data;
  const types = useCottageTypes().data ?? [];
  const allCottages = useCottages().data ?? [];
  const { filters } = useFilters();
  const scope = scopedCottages(filters.scope, allCottages);
  const cottages = allCottages.filter((c) => !scope || scope.has(c.id));
  const [cottageId, setCottageId] = useState<string | undefined>();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const active = cottages.find((c) => c.id === cottageId) ?? cottages[0];
  const type = types.find((t) => t.id === active?.type_id);

  useEffect(() => {
    if (cottageId && !cottages.some((c) => c.id === cottageId)) setCottageId(undefined);
  }, [cottages, cottageId]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const from = addDays(`${month}-01`, -1);
  const to = grid.at(-1) ?? `${month}-28`;
  const q = useQuery({
    queryKey: ["cal-month", active?.id, month],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, code, slot, status, starts_at, ends_at, hold_until, checked_out_at, block_reason, pax_adults, pax_children, guests(name)")
        .eq("cottage_id", active!.id)
        .gte("stay_date", from)
        .lte("stay_date", to);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CalBooking[];
    },
  });

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!active || !settings || !type) return <LoadingState />;

  const rate = (date: string, half: "day" | "night") => {
    const base = half === "day" ? Number(type.rate_day) : Number(type.rate_night);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return base + (dow === 5 || dow === 6 ? Number(type.weekend_surcharge) : 0);
  };
  const list = q.data ?? [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[88px_minmax(0,1fr)_340px]">
      {/* The rail: every cottage in scope, the open one ringed (Malaya's villa rail). */}
      <nav aria-label="Cottages" className="no-scrollbar flex gap-2.5 overflow-x-auto xl:max-h-[calc(100vh-14rem)] xl:flex-col xl:overflow-y-auto xl:overflow-x-visible">
        {cottages.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.name}
            aria-pressed={c.id === active.id}
            onClick={() => setCottageId(c.id)}
            className={cn("flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition", c.id === active.id ? "ring-2 ring-foreground" : "opacity-75 hover:opacity-100")}
          >
            <PhotoTile name={c.name} className="size-14 rounded-[10px] [&>span]:text-base [&>span]:tracking-[0.15em]" />
            <span className="max-w-16 truncate text-[11px] font-medium">{c.name}</span>
          </button>
        ))}
      </nav>

      <Card className="border-border/70 bg-surface shadow-level-2">
        <CardContent className="p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="malaya-eyebrow">{type.name}</p>
              <h3 className="font-display text-xl">{active.name} · {niceDate(`${month}-01`, { month: "long", year: "numeric" })}</h3>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card p-0.5 shadow-level-1">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
              <Button variant="ghost" className="rounded-full px-3" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Today</Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
            {grid.map((date, i) => {
              if (!date) return <div key={`pad-${i}`} />;
              const halves = (["day", "night"] as const).map((h) => ({ h, b: occupant(list, settings, date, h) }));
              const past = date < today;
              const isSel = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  className={cn(
                    "flex h-[92px] min-w-0 flex-col items-stretch gap-1 overflow-hidden rounded-xl border p-1 text-left transition-colors lg:h-[112px] lg:p-1.5",
                    isSel ? "border-foreground bg-foreground/[0.04] ring-1 ring-foreground" : "border-border/70 bg-background hover:border-foreground/40",
                    past && !isSel && "opacity-50",
                  )}
                >
                  <span className={cn("self-center text-[13px] font-semibold tabular-nums leading-none lg:text-sm", date === today && "grid size-6 place-items-center rounded-full bg-destructive text-[12px] text-destructive-foreground")}>
                    {Number(date.slice(8))}
                  </span>
                  {tileBlocks(halves).map(({ key, b, half }) => {
                    // A 22-hour stay from the day before still holds this morning.
                    const carried = !!b && half === "day" && Date.parse(b.starts_at) < halfRange(settings, date, "day")[0];
                    const note = carried ? ` · till ${niceTime(b.ends_at)}` : !half && b ? ` · ${b.slot === "h22" ? "22 hrs" : "day + night"}` : "";
                    return (
                      <span
                        key={key}
                        className={cn(
                          "flex min-h-0 flex-1 items-center justify-center gap-1 truncate rounded-md px-1 text-[10px] font-medium lg:text-[11px]",
                          b ? tone(b) : "text-muted-foreground",
                          carried && "opacity-60",
                        )}
                      >
                        {!b ? (
                          <><span className="opacity-60">{half === "day" ? "Day" : "Night"}</span><span className="hidden tabular-nums lg:inline">{compact(rate(date, half ?? "day"))}</span></>
                        ) : b.status === "blocked" ? (
                          <><Ban className="hidden size-3 shrink-0 lg:block" /><span className="truncate">{b.block_reason}</span></>
                        ) : (
                          <span className="truncate">{b.guests?.name.split(" ")[0] ?? "Guest"}<span className="hidden opacity-70 lg:inline">{note}</span></span>
                        )}
                      </span>
                    );
                  })}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-foreground px-2.5 py-0.5 font-medium text-background">Booked</span>
            <span className="rounded-full bg-success/20 px-2.5 py-0.5 font-medium">In house</span>
            <span className="rounded-full bg-warning/25 px-2.5 py-0.5 font-medium">Pending</span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground line-through">Blocked</span>
            <span className="rounded-full border border-border/70 px-2.5 py-0.5 font-medium text-muted-foreground">Free · rate</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Each date has a Day half ({settings.day_start.slice(0, 5)}–{settings.day_end.slice(0, 5)}) and a Night half ({settings.night_start.slice(0, 5)}–{settings.night_end.slice(0, 5)}). A 22-hour stay ({settings.h22_start.slice(0, 5)} to {settings.h22_end.slice(0, 5)} next day) fills both, then shows faded with “till” on the next morning.
          </p>
        </CardContent>
      </Card>

      <DayPanel cottageId={active.id} cottageName={active.name} date={selected} list={list} settings={settings} rate={rate} />
    </div>
  );
}

/** The selected date on the selected cottage: each half, and what you can do with it. */
function DayPanel({ cottageId, cottageName, date, list, settings, rate }: { cottageId: string; cottageName: string; date: string; list: CalBooking[]; settings: Settings; rate: (d: string, h: "day" | "night") => number }) {
  const booking = useBookingDialog();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = manilaToday();
  const halves = (["day", "night"] as const).map((h) => ({ h, b: occupant(list, settings, date, h) }));

  async function unblock(id: string) {
    try {
      await rpc("set_booking_status", { p_booking: id, p_action: "unblock", p_reason: "" });
      toast.success("Slot reopened");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-surface shadow-level-2">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="malaya-eyebrow">{cottageName}</p>
            <h3 className="font-display text-xl">{niceDate(date, { weekday: "long", month: "long", day: "numeric" })}</h3>
          </div>
          {halves.map(({ h, b }) => (
            <div key={h} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{h === "day" ? "Day" : "Night"}</p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> {h === "day" ? `${settings.day_start.slice(0, 5)}–${settings.day_end.slice(0, 5)}` : `${settings.night_start.slice(0, 5)}–${settings.night_end.slice(0, 5)}`}</span>
              </div>
              {b ? (
                b.status === "blocked" ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Ban className="size-4" /> {b.block_reason}</p>
                    <Button size="sm" variant="outline" onClick={() => unblock(b.id)}>Unblock</Button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{b.guests?.name ?? "Guest"}</p>
                        <p className="text-xs text-muted-foreground">{b.code} · {SLOT_LABEL[b.slot]} · {b.pax_adults + b.pax_children} pax</p>
                      </div>
                      <StatusPill status={b.status} checkedOut={!!b.checked_out_at} />
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => navigate({ to: "/admin/bookings/$id", params: { id: b.id } })}>Open booking</Button>
                  </div>
                )
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-muted-foreground">Free · <span className="font-medium text-foreground">{php(rate(date, h))}</span> {h === "day" ? "day tour" : "overnight"}</p>
                  {date >= today && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={() => booking.open({ cottage_id: cottageId, date, slot: h, source: date === today ? "walk_in" : "messenger" })}>Book</Button>
                      <Button size="sm" variant="outline" onClick={() => booking.open({ cottage_id: cottageId, date, slot: h, mode: "block" })}>Block</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {halves.every((x) => !x.b) && date >= today && (
            <Button variant="outline" className="w-full" onClick={() => booking.open({ cottage_id: cottageId, date, slot: "h22", source: "messenger" })}>Book 22 hours</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------------------------------------------- all-cottages week

function mondayOf(iso: string) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

function WeekGrid() {
  const today = manilaToday();
  const [start, setStart] = useState(() => mondayOf(today));
  const [span, setSpan] = useState<"7" | "14">("7");
  const n = Number(span);
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const navigate = useNavigate();
  const booking = useBookingDialog();
  const { filters } = useFilters();
  const allCottages = useCottages().data ?? [];
  const scope = scopedCottages(filters.scope, allCottages);

  const boards = useQueries({ queries: days.map((d) => ({ queryKey: ["board", d], queryFn: () => rpc<BoardHalf[]>("board", { p_date: d }) })) });
  const err = boards.find((b) => b.error)?.error;
  const grid = boards.map((b) => byCottage((b.data ?? []).filter((h) => !scope || scope.has(h.cottage_id))));
  const cottages = grid[0] ?? [];

  const tap = (h: BoardHalf | undefined, cottage: string, date: string, half: "day" | "night") => {
    if (h?.booking_id) navigate({ to: "/admin/bookings/$id", params: { id: h.booking_id } });
    else booking.open({ cottage_id: cottage, date, slot: half, source: date === today ? "walk_in" : "messenger" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card p-0.5 shadow-level-1">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setStart(addDays(start, -n))} aria-label="Earlier"><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" className="rounded-full px-3" onClick={() => setStart(mondayOf(today))}>{niceDate(days[0]!, { month: "short", day: "numeric" })} – {niceDate(days.at(-1)!, { month: "short", day: "numeric" })}</Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setStart(addDays(start, n))} aria-label="Later"><ChevronRight className="size-4" /></Button>
        </div>
        <ChipGroup label="Span" value={span} onChange={setSpan} chips={[{ value: "7", label: "Week" }, { value: "14", label: "2 weeks" }]} />
      </div>
      {err ? <ErrorState error={err} /> : boards.some((b) => b.isLoading) ? <LoadingState /> : (
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: 180 + n * 96 }}>
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="sticky left-0 z-10 bg-surface p-3 text-left"><span className="malaya-eyebrow">Cottage</span></th>
                    {days.map((d) => (
                      <th key={d} className={cn("p-2 text-center font-medium", d === today && "bg-secondary/70")}>
                        <span className={cn("block text-[11px] uppercase tracking-wide", d === today ? "text-primary" : "text-muted-foreground")}>{niceDate(d, { weekday: "short" })}</span>
                        <span className="font-display text-sm">{niceDate(d, { month: "short", day: "numeric" })}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cottages.map((c, row) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                        <p className="font-display text-sm">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.type}</p>
                      </td>
                      {days.map((d, i) => {
                        const cell = grid[i]?.[row];
                        return (
                          <td key={d} className={cn("p-1", d === today && "bg-secondary/40")}>
                            <div className="grid grid-cols-2 gap-0.5">
                              {(["day", "night"] as const).map((half) => {
                                const h = cell?.[half];
                                const st = halfState(h);
                                return (
                                  <button
                                    key={half}
                                    onClick={() => tap(h, c.id, d, half)}
                                    title={`${half === "day" ? "Day" : "Night"} · ${h?.guest_name ?? h?.block_reason ?? "free"}`}
                                    className={cn("h-10 truncate rounded-lg px-1 text-[10px] font-medium", HALF_STYLE[st])}
                                  >
                                    {st === "free" ? (half === "day" ? "D" : "N") : (h?.guest_name ?? h?.block_reason ?? "").split(" ")[0]}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      <Legend />
    </div>
  );
}
