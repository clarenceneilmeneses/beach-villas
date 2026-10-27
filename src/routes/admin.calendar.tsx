import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Settings2 } from "@/components/icons";
import { byCottage, HALF_STYLE, halfState, Legend, type BoardHalf } from "@/components/obs/board";
import { useBookingDialog } from "@/components/obs/booking-dialog";
import { SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStaff } from "@/lib/auth";
import { addDays, manilaToday, niceDate } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/calendar")({ component: Calendar });

function mondayOf(iso: string) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

function Calendar() {
  const today = manilaToday();
  const [start, setStart] = useState(() => mondayOf(today));
  const [span, setSpan] = useState<7 | 14>(7);
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const owner = useStaff().data?.role === "owner";
  const navigate = useNavigate();
  const booking = useBookingDialog();

  const boards = useQueries({ queries: days.map((d) => ({ queryKey: ["board", d], queryFn: () => rpc<BoardHalf[]>("board", { p_date: d }) })) });
  const err = boards.find((b) => b.error)?.error;
  const grid = boards.map((b) => byCottage(b.data ?? []));
  const cottages = grid[0] ?? [];

  const tap = (h: BoardHalf | undefined, cottage: string, date: string, half: "day" | "night") => {
    if (h?.booking_id) navigate({ to: "/admin/bookings/$id", params: { id: h.booking_id } });
    else booking.open({ cottage_id: cottage, date, slot: half, source: date === today ? "walk_in" : "messenger" });
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={`${niceDate(days[0]!, { month: "short", day: "numeric" })} – ${niceDate(days.at(-1)!, { month: "short", day: "numeric" })}`}
        title="Every cottage, day and night"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card p-0.5 shadow-level-1">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setStart(addDays(start, -span))} aria-label="Earlier"><ChevronLeft className="size-4" /></Button>
              <Button variant="ghost" className="rounded-full px-3" onClick={() => setStart(mondayOf(today))}>This week</Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setStart(addDays(start, span))} aria-label="Later"><ChevronRight className="size-4" /></Button>
            </div>
            <div className="inline-flex gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1">
              {([7, 14] as const).map((n) => (
                <button key={n} onClick={() => setSpan(n)} className={cn("rounded-full px-3 py-1 text-[13px]", span === n ? "bg-secondary font-medium text-primary" : "text-muted-foreground")}>{n === 7 ? "Week" : "2 weeks"}</button>
              ))}
            </div>
            <Button variant="outline" onClick={() => booking.open({ date: today, mode: "block" })}>Block a slot</Button>
            {owner && (
              <Button variant="outline" asChild>
                <Link to="/admin/settings/cottages"><Settings2 className="size-4" /> Rates & pax</Link>
              </Button>
            )}
          </div>
        }
      />

      {err ? <ErrorState error={err} /> : boards.some((b) => b.isLoading) ? <LoadingState /> : (
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: 180 + span * 96 }}>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <p className="text-xs text-muted-foreground">Tap a free half to book or block it. Airbnb and Booking.com sync can be switched on later.</p>
      </div>
    </div>
  );
}
