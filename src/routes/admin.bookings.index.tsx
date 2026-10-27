import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight } from "@/components/icons";
import { useBookingDialog } from "@/components/obs/booking-dialog";
import { SourcePill, StatusPill } from "@/components/obs/booking-bits";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ChipGroup } from "@/components/obs/chip-group";
import { SearchPill } from "@/components/obs/search-pill";
import { BookingCard } from "@/components/obs/booking-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collectedOf, pax, useBookings, type BookingRow } from "@/lib/bookings";
import { niceDate, niceDateTime, php, SLOT_LABEL } from "@/lib/format";

export const Route = createFileRoute("/admin/bookings/")({ component: Reservations });

type Tab = "active" | "to_settle" | "settled" | "cancelled" | "all";
const TABS: { value: Tab; label: string; test: (b: BookingRow) => boolean; waiting?: boolean }[] = [
  { value: "active", label: "Active", test: (b) => ["pending", "confirmed", "checked_in"].includes(b.status) && !b.checked_out_at },
  { value: "to_settle", label: "To settle", test: (b) => !!b.checked_out_at && ["confirmed", "checked_in"].includes(b.status), waiting: true },
  { value: "settled", label: "Settled", test: (b) => b.status === "settled" },
  { value: "cancelled", label: "Cancelled", test: (b) => ["cancelled", "no_show", "expired"].includes(b.status) },
  { value: "all", label: "All", test: () => true },
];

function Reservations() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const q = useBookings({ search });
  const booking = useBookingDialog();
  const all = q.data ?? [];
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, all.filter(t.test).length])) as Record<Tab, number>, [all]);
  const rows = all.filter(TABS.find((t) => t.value === tab)!.test);

  const live = all.filter((b) => !["cancelled", "no_show", "expired"].includes(b.status));
  const totals = {
    count: live.length,
    booked: live.reduce((s, b) => s + Number(b.final_amount ?? b.estimate), 0),
    collected: all.reduce((s, b) => s + collectedOf(b), 0),
    toSettle: counts.to_settle ?? 0,
  };

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Reservations · every channel" title="All reservations" action={<Button onClick={() => booking.open({ source: "messenger" })}>New reservation</Button>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Reservations" value={String(totals.count)} sub="Excludes cancelled and no-shows" />
        <KpiCard label="Booked value" value={php(totals.booked)} sub="Final amount, or the estimate" />
        <KpiCard label="Collected" value={php(totals.collected)} sub="Verified payments only" />
        <KpiCard label="To settle" value={String(totals.toSettle)} sub="Checked out, final not logged" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ChipGroup label="Reservation status" value={tab} onChange={setTab} chips={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value], waiting: t.waiting }))} />
        <SearchPill className="w-full flex-1 sm:w-auto" placeholder="Search BK- number, guest or mobile" value={search} onChange={setSearch} />
      </div>

      {q.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="No reservations here" message={search ? `Nothing matches “${search}” on this tab.` : "Walk-ins, chat and website bookings appear here."} />
      ) : (
        <>
          <Card className="hidden border-border/70 bg-surface shadow-level-2 lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction date</TableHead>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Cottage</TableHead>
                    <TableHead>Stay</TableHead>
                    <TableHead className="text-right">Booking</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Handled by</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((b) => (
                    <TableRow key={b.id} className="hover:bg-secondary/50">
                      <TableCell className="whitespace-nowrap text-sm">{niceDateTime(b.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {b.code}
                        <div className="mt-1"><SourcePill source={b.source} /></div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{b.guests?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{b.guests?.mobile}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.cottages?.name}
                        <p className="text-xs text-muted-foreground">{b.cottages?.cottage_types?.name}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {niceDate(b.stay_date)}
                        <p className="text-xs text-muted-foreground">{SLOT_LABEL[b.slot]} · {pax(b)} pax</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{php(b.final_amount ?? b.estimate)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{php(collectedOf(b))}</TableCell>
                      <TableCell><StatusPill status={b.status} checkedOut={!!b.checked_out_at} /></TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{b.created_by}</TableCell>
                      <TableCell>
                        <Link to="/admin/bookings/$id" params={{ id: b.id }} className="link-action inline-flex items-center gap-1 text-xs font-semibold">
                          Open <ArrowRight className="size-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-3 lg:hidden">
            {rows.map((b) => <BookingCard key={b.id} b={b} />)}
          </div>
        </>
      )}
    </div>
  );
}
