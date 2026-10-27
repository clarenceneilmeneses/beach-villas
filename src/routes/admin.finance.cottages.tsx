import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/obs/app-shell";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCottages } from "@/lib/data";
import { useSummary } from "@/lib/finance";
import { scopedCottages, useFilters } from "@/lib/filters";
import { php } from "@/lib/format";

export const Route = createFileRoute("/admin/finance/cottages")({ component: () => <OwnerOnly><PerCottage /></OwnerOnly> });

/** Malaya's property P&L, one row per cottage — totals from the database (finance_summary). */
function PerCottage() {
  const { filters, range } = useFilters();
  const scope = scopedCottages(filters.scope, useCottages().data ?? []);
  const q = useSummary(range.from, range.to, scope);
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <LoadingState />;
  const s = q.data;
  const rows = s.cottages.map((c) => ({ ...c, occ: Math.round((Number(c.halves) / (range.days * 2)) * 100), net: Number(c.collected) - Number(c.expenses) }));
  const best = [...rows].sort((a, b) => Number(b.collected) - Number(a.collected))[0];
  const resortWide = Number(s.expenses) - rows.reduce((a, c) => a + Number(c.expenses), 0);

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Per cottage · ${range.span}`} title="Which cottages earn" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Collected" value={php(s.collected)} sub={`${rows.length} cottages`} />
        <KpiCard label="Occupancy" value={`${s.capacity ? Math.round((Number(s.halves) / s.capacity) * 100) : 0}%`} sub="Day and night halves" />
        <KpiCard label="Top cottage" value={best?.name ?? "—"} sub={best ? php(best.collected) : ""} />
        <KpiCard label="Resort-wide costs" value={php(resortWide)} sub="Not split per cottage" />
      </div>
      <Card className="border-border/70 bg-surface shadow-level-2">
        <CardContent className="p-0">
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
              {rows.map((r) => (
                <TableRow key={r.id} className="tabular-nums">
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.day}</TableCell>
                  <TableCell className="text-right">{r.night}</TableCell>
                  <TableCell className="text-right">{r.h22}</TableCell>
                  <TableCell className="text-right">{r.occ}%</TableCell>
                  <TableCell className="text-right">{php(r.collected)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{php(r.discounts)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{php(r.expenses)}</TableCell>
                  <TableCell className="text-right font-semibold">{php(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Money in counts payments made in the period; stays, occupancy and discounts count stays in the period.</p>
    </div>
  );
}
