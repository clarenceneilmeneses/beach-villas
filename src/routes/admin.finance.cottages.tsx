import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OwnerOnly } from "@/components/obs/app-shell";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { PeriodChips } from "@/components/obs/period-chips";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCottages } from "@/lib/data";
import { range, signed, type Period } from "@/lib/finance";
import { halvesOf, php, type Slot } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/finance/cottages")({ component: () => <OwnerOnly><PerCottage /></OwnerOnly> });

/** Malaya's property P&L, one row per cottage. */
function PerCottage() {
  const [period, setPeriod] = useState<Period>("month");
  const { from, to, days } = range(period);
  const cottages = useCottages().data ?? [];
  const q = useQuery({
    queryKey: ["per-cottage", from, to],
    queryFn: async () => {
      const [b, e] = await Promise.all([
        supabase.from("bookings").select("cottage_id, slot, status, estimate, final_amount, payments(amount, kind, status)").gte("stay_date", from).lte("stay_date", to).in("status", ["confirmed", "checked_in", "settled", "no_show", "cancelled"]),
        supabase.from("expenses").select("cottage_id, amount").gte("spent_on", from).lte("spent_on", to),
      ]);
      if (b.error) throw new Error(b.error.message);
      return { bookings: (b.data ?? []) as any[], expenses: (e.data ?? []) as any[] };
    },
  });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <LoadingState />;

  const data = cottages.map((c) => {
    const bs = q.data.bookings.filter((b) => b.cottage_id === c.id);
    const occupied = bs.filter((b) => !["cancelled", "no_show"].includes(b.status));
    const collected = bs.reduce((s, b) => s + (b.payments ?? []).filter((p: any) => p.status === "verified").reduce((a: number, p: any) => a + signed(p), 0), 0);
    const discount = bs.filter((b) => b.status === "settled").reduce((s, b) => s + Math.max(0, Number(b.estimate) - Number(b.final_amount ?? 0)), 0);
    const expenses = q.data.expenses.filter((x) => x.cottage_id === c.id).reduce((s, x) => s + Number(x.amount), 0);
    const halves = occupied.reduce((s, b) => s + halvesOf(b.slot as Slot), 0);
    return {
      c,
      day: occupied.filter((b) => b.slot === "day").length,
      night: occupied.filter((b) => b.slot === "night" || b.slot === "day_night").length,
      h22: occupied.filter((b) => b.slot === "h22").length,
      occ: Math.round((halves / (days * 2)) * 100),
      collected,
      discount,
      expenses,
      net: collected - expenses,
    };
  });
  const resortExpenses = q.data.expenses.filter((x) => !x.cottage_id).reduce((s, x) => s + Number(x.amount), 0);
  const totalCollected = data.reduce((s, r) => s + r.collected, 0);
  const avgOcc = data.length ? Math.round(data.reduce((s, r) => s + r.occ, 0) / data.length) : 0;
  const best = [...data].sort((a, b) => b.collected - a.collected)[0];

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Per cottage" title="Which cottages earn" />
      <PeriodChips value={period} onChange={setPeriod} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Collected" value={php(totalCollected)} sub="All cottages" />
        <KpiCard label="Occupancy" value={`${avgOcc}%`} sub="Day and night halves" />
        <KpiCard label="Top cottage" value={best?.c.name ?? "—"} sub={best ? php(best.collected) : ""} />
        <KpiCard label="Resort-wide costs" value={php(resortExpenses)} sub="Not split per cottage" />
      </div>
      <Card className="border-border/70 bg-surface shadow-level-2">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cottage</TableHead>
                  <TableHead className="text-right">Day</TableHead>
                  <TableHead className="text-right">Night</TableHead>
                  <TableHead className="text-right">22 hrs</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Discounts</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.c.id} className="tabular-nums">
                    <TableCell className="font-medium">{r.c.name}</TableCell>
                    <TableCell className="text-right">{r.day}</TableCell>
                    <TableCell className="text-right">{r.night}</TableCell>
                    <TableCell className="text-right">{r.h22}</TableCell>
                    <TableCell className="text-right">{r.occ}%</TableCell>
                    <TableCell className="text-right">{php(r.collected)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{php(r.discount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{php(r.expenses)}</TableCell>
                    <TableCell className="text-right font-semibold">{php(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
