import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft01Icon, ArrowRight01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { BookingSheet, type BookingPreset } from "@/components/booking-sheet";
import { byCottage, HALF_STYLE, halfState, Legend, type BoardHalf } from "@/components/board";
import { Button, Icon, SchemaNotice, Spinner } from "@/components/ui";
import { useStaff } from "@/lib/auth";
import { addDays, cn, manilaToday, niceDate } from "@/lib/format";
import { rpc } from "@/lib/supabase";

export const Route = createFileRoute("/admin/calendar")({ component: Calendar });

function mondayOf(iso: string) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

function Calendar() {
  const [start, setStart] = useState(() => mondayOf(manilaToday()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const owner = useStaff().data?.role === "owner";
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<BookingPreset | null>(null);

  const boards = useQueries({
    queries: days.map((d) => ({ queryKey: ["board", d], queryFn: () => rpc<BoardHalf[]>("board", { p_date: d }) })),
  });
  const err = boards.find((b) => b.error)?.error;
  const loading = boards.some((b) => b.isLoading);
  const grid = boards.map((b) => byCottage(b.data ?? []));
  const cottages = grid[0] ?? [];
  const today = manilaToday();

  const tap = (h: BoardHalf | undefined, cottage: string, date: string, half: "day" | "night") => {
    if (h?.booking_id) navigate({ to: "/admin/bookings/$id", params: { id: h.booking_id } });
    else setSheet({ cottage_id: cottage, date, slot: half, source: date === today ? "walk_in" : "messenger" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        {owner && (
          <Link to="/admin/settings" className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium">
            <Icon icon={Settings01Icon} size={16} /> Rates & pax
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => setStart(addDays(start, -7))} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Previous week"><Icon icon={ArrowLeft01Icon} /></button>
        <button onClick={() => setStart(mondayOf(today))} className="text-sm font-medium">
          {niceDate(days[0]!, { month: "short", day: "numeric" })} – {niceDate(days[6]!, { month: "short", day: "numeric" })}
        </button>
        <button onClick={() => setStart(addDays(start, 7))} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Next week"><Icon icon={ArrowRight01Icon} /></button>
      </div>

      {err ? <SchemaNotice error={err} /> : loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white p-2 text-left font-semibold">Cottage</th>
                {days.map((d) => (
                  <th key={d} className={cn("p-2 text-center font-medium", d === today && "text-sky-700")}>
                    {niceDate(d, { weekday: "short" })}<br /><span className="text-neutral-400">{niceDate(d, { month: "short", day: "numeric" })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cottages.map((c, row) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="sticky left-0 z-10 bg-white p-2">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-[10px] text-neutral-400">{c.type}</p>
                  </td>
                  {days.map((d, i) => {
                    const cell = grid[i]?.[row];
                    return (
                      <td key={d} className="p-1">
                        <div className="grid grid-cols-2 gap-0.5">
                          {(["day", "night"] as const).map((half) => {
                            const h = cell?.[half];
                            const st = halfState(h);
                            return (
                              <button
                                key={half}
                                onClick={() => tap(h, c.id, d, half)}
                                title={`${half === "day" ? "Day" : "Night"}${h?.guest_name ? ` · ${h.guest_name}` : h?.block_reason ? ` · ${h.block_reason}` : " · free"}`}
                                className={cn("h-9 truncate rounded-md px-1 text-[10px]", HALF_STYLE[st])}
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
      )}
      <Legend />
      <p className="text-xs text-neutral-500">Tap a free half to add a booking or block it. Airbnb and Booking.com sync can be switched on later.</p>
      <Button tone="outline" className="w-full" onClick={() => setSheet({ date: today, mode: "block" })}>Block a slot</Button>
      <BookingSheet open={!!sheet} onClose={() => setSheet(null)} preset={sheet ?? {}} />
    </div>
  );
}
