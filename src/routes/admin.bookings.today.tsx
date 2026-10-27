import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Card, CardContent } from "@/components/ui/card";
import { useBookings, type BookingRow } from "@/lib/bookings";
import { addDays, manilaToday, niceDate } from "@/lib/format";
import { BookingCard } from "@/components/obs/booking-card";

export const Route = createFileRoute("/admin/bookings/today")({ component: Today });

/** Malaya's Today: who is arriving, who is in, who still has to settle. */
function Today() {
  const today = manilaToday();
  const q = useBookings({ from: addDays(today, -1), to: today, limit: 500 });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <LoadingState />;
  const rows = q.data ?? [];
  const groups: { title: string; hint: string; rows: BookingRow[] }[] = [
    { title: "To settle", hint: "Checked out, final amount not logged yet", rows: rows.filter((b) => b.checked_out_at && ["confirmed", "checked_in"].includes(b.status)) },
    { title: "In house", hint: "Checked in", rows: rows.filter((b) => b.status === "checked_in" && !b.checked_out_at) },
    { title: "Arriving", hint: "Confirmed or waiting on a downpayment", rows: rows.filter((b) => b.stay_date === today && ["confirmed", "pending"].includes(b.status)) },
    { title: "Settled today", hint: "Done", rows: rows.filter((b) => b.status === "settled" && b.stay_date === today) },
  ];
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Today · ${niceDate(today, { weekday: "long", month: "long", day: "numeric" })}`} title="Arrivals, guests in house, and settling" />
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        {groups.map((g) => (
          <section key={g.title}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-display text-base">{g.title} <span className="text-muted-foreground">· {g.rows.length}</span></h3>
              <p className="text-xs text-muted-foreground">{g.hint}</p>
            </div>
            {g.rows.length ? (
              <div className="space-y-3">{g.rows.map((b) => <BookingCard key={b.id} b={b} />)}</div>
            ) : (
              <Card className="border-dashed shadow-none"><CardContent className="p-5 text-sm text-muted-foreground">Nobody here.</CardContent></Card>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
