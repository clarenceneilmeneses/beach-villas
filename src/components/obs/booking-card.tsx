import { Link } from "@tanstack/react-router";
import { SourcePill, StatusPill } from "./booking-bits";
import { Card, CardContent } from "@/components/ui/card";
import { collectedOf, pax, type BookingRow } from "@/lib/bookings";
import { niceDate, php, SLOT_LABEL } from "@/lib/format";

/** The phone's version of a table row, as in Malaya. */
export function BookingCard({ b }: { b: BookingRow }) {
  return (
    <Link to="/admin/bookings/$id" params={{ id: b.id }} className="block">
      <Card className="malaya-lift border-border/70 bg-surface shadow-level-1">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-base">{b.guests?.name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{b.code} · {b.cottages?.name}</p>
            </div>
            <StatusPill status={b.status} checkedOut={!!b.checked_out_at} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{niceDate(b.stay_date)}</span>
            <span>· {SLOT_LABEL[b.slot]}</span>
            <span>· {pax(b)} pax</span>
            <SourcePill source={b.source} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-secondary/70 px-2 py-1.5">
              <p className="text-[10px] uppercase text-muted-foreground">Booking</p>
              <p className="text-sm font-semibold tabular-nums">{php(b.final_amount ?? b.estimate)}</p>
            </div>
            <div className="rounded-lg bg-secondary/70 px-2 py-1.5">
              <p className="text-[10px] uppercase text-muted-foreground">Collected</p>
              <p className="text-sm font-semibold tabular-nums">{php(collectedOf(b))}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
