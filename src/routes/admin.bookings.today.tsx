import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "@/components/icons";
import { SourcePill, StatusPill } from "@/components/obs/booking-bits";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ChipGroup } from "@/components/obs/chip-group";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collectedOf, pax, useBookings, type BookingRow } from "@/lib/bookings";
import { slotTimes, useCottages, useSettings } from "@/lib/data";
import { scopedCottages, useFilters } from "@/lib/filters";
import { addDays, manilaToday, niceDate, php, SLOT_LABEL } from "@/lib/format";
import { rpc } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings/today")({ component: Today });

type Group = "settle" | "in" | "arriving" | "settled";

/** The front desk's day: who to settle, who is in, who is coming, who is done. */
function Today() {
  const today = manilaToday();
  const { filters } = useFilters();
  const cottageIds = scopedCottages(filters.scope, useCottages().data ?? []);
  const q = useBookings({ from: addDays(today, -1), to: today, limit: 500, cottageIds });
  const settings = useSettings().data;
  const qc = useQueryClient();
  const [group, setGroup] = useState<Group | null>(null);

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <LoadingState />;
  const rows = q.data ?? [];
  const groups: Record<Group, BookingRow[]> = {
    settle: rows.filter((b) => b.checked_out_at && ["confirmed", "checked_in"].includes(b.status)),
    in: rows.filter((b) => b.status === "checked_in" && !b.checked_out_at),
    arriving: rows.filter((b) => b.stay_date === today && ["confirmed", "pending"].includes(b.status)),
    settled: rows.filter((b) => b.status === "settled" && b.stay_date === today),
  };
  // Open on the first group with someone in it, the way a desk works the day.
  const picked: Group = group ?? ((["settle", "in", "arriving", "settled"] as Group[]).find((g) => groups[g].length) ?? "arriving");
  const list = groups[picked];

  async function act(b: BookingRow, action: "check_in" | "check_out") {
    try {
      await rpc("set_booking_status", { p_booking: b.id, p_action: action, p_reason: "" });
      toast.success(action === "check_in" ? `${b.guests?.name ?? "Guest"} checked in` : `${b.guests?.name ?? "Guest"} checked out — settle next`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const action = (b: BookingRow) =>
    picked === "arriving" && b.status === "confirmed" ? (
      <Button size="sm" variant="success" onClick={() => act(b, "check_in")}>Check in</Button>
    ) : picked === "in" ? (
      <Button size="sm" variant="outline" onClick={() => act(b, "check_out")}>Check out</Button>
    ) : picked === "settle" ? (
      <Button size="sm" asChild><Link to="/admin/bookings/$id" params={{ id: b.id }}>Settle</Link></Button>
    ) : (
      <Link to="/admin/bookings/$id" params={{ id: b.id }} className="link-action inline-flex items-center gap-1 text-xs font-semibold">Open <ArrowRight className="size-3.5" /></Link>
    );

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Today · ${niceDate(today, { weekday: "long", month: "long", day: "numeric" })}`} title="The front desk's day" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="To settle" value={String(groups.settle.length)} sub="Checked out, final not logged" />
        <KpiCard label="In house" value={String(groups.in.length)} sub={`${groups.in.reduce((s, b) => s + pax(b), 0)} guests on the beach`} />
        <KpiCard label="Arriving" value={String(groups.arriving.length)} sub="Confirmed or pending" />
        <KpiCard label="Settled today" value={String(groups.settled.length)} sub={php(groups.settled.reduce((s, b) => s + collectedOf(b), 0))} />
      </div>

      <ChipGroup
        label="Who"
        value={picked}
        onChange={setGroup}
        chips={[
          { value: "settle", label: "To settle", count: groups.settle.length, waiting: true },
          { value: "in", label: "In house", count: groups.in.length },
          { value: "arriving", label: "Arriving", count: groups.arriving.length },
          { value: "settled", label: "Settled", count: groups.settled.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState title="Nobody here" message="This list fills as guests arrive, check in and check out." />
      ) : (
        <>
          <Card className="hidden border-border/70 bg-surface shadow-level-2 md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Cottage</TableHead>
                    <TableHead>Stay</TableHead>
                    <TableHead className="text-right">Booking</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((b) => (
                    <TableRow key={b.id} className="hover:bg-secondary/50">
                      <TableCell>
                        <Link to="/admin/bookings/$id" params={{ id: b.id }} className="text-sm font-medium hover:underline">{b.guests?.name ?? "—"}</Link>
                        <p className="font-mono text-[11px] text-muted-foreground">{b.code}</p>
                      </TableCell>
                      <TableCell className="text-sm">{b.cottages?.name}<p className="text-xs text-muted-foreground">{b.cottages?.cottage_types?.name}</p></TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {SLOT_LABEL[b.slot]} · {pax(b)} pax
                        <p className="text-xs text-muted-foreground">{slotTimes(settings, b.slot)}</p>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{php(b.final_amount ?? b.estimate)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{php(collectedOf(b))}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1"><StatusPill status={b.status} checkedOut={!!b.checked_out_at} verifying={b.payments?.some((p) => p.status === "submitted")} /><SourcePill source={b.source} /></div></TableCell>
                      <TableCell className="text-right">{action(b)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-3 md:hidden">
            {list.map((b) => (
              <Card key={b.id} className="border-border/70 bg-surface shadow-level-1">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/admin/bookings/$id" params={{ id: b.id }} className="min-w-0">
                      <p className="truncate font-display text-base">{b.guests?.name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.code} · {b.cottages?.name} · {SLOT_LABEL[b.slot]} · {pax(b)} pax</p>
                    </Link>
                    <StatusPill status={b.status} checkedOut={!!b.checked_out_at} verifying={b.payments?.some((p) => p.status === "submitted")} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{php(collectedOf(b))} of {php(b.final_amount ?? b.estimate)}</p>
                    {action(b)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
