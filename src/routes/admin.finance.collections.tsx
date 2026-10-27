import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "@/components/icons";
import { OwnerOnly } from "@/components/obs/app-shell";
import { MethodPill } from "@/components/obs/booking-bits";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar, usePagination } from "@/components/obs/paginated";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv, signed, usePayments } from "@/lib/finance";
import { scopedCottages, useFilters } from "@/lib/filters";
import { useCottages } from "@/lib/data";
import { niceDate, niceDateTime, php } from "@/lib/format";

export const Route = createFileRoute("/admin/finance/collections")({ component: () => <OwnerOnly><Collections /></OwnerOnly> });

function Collections() {
  const { filters, range: picked } = useFilters();
  const allCottages = useCottages().data ?? [];
  const { from, to } = picked;
  const q = usePayments(from, to);
  const scope = scopedCottages(filters.scope, allCottages);
  const rows = (q.data ?? []).filter((p) => !scope || scope.has(p.bookings?.cottage_id));
  const paged = usePagination(rows, { initialPageSize: 50, resetKey: `${from}|${to}|${filters.scope}` });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const by = (m: string) => rows.filter((p) => p.method === m).reduce((s, p) => s + signed(p), 0);
  const total = rows.reduce((s, p) => s + signed(p), 0);
  const dp = rows.filter((p) => p.kind === "downpayment").reduce((s, p) => s + signed(p), 0);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={`Collections · ${niceDate(from, { month: "short", day: "numeric" })} – ${niceDate(to, { month: "short", day: "numeric" })}`}
        title="Money in"
        action={<Button variant="outline" onClick={() => downloadCsv(`collections-${from}-${to}.csv`, rows.map((p) => ({ date: p.created_at, booking: p.bookings?.code, guest: p.bookings?.guests?.name, cottage: p.bookings?.cottages?.name, kind: p.kind, method: p.method, amount: p.amount, staff: p.created_by, edited: p.edited })))}><Download className="size-4" /> Export CSV</Button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Collected" value={php(total)} sub={`${rows.length} verified payments`} />
        <KpiCard label="Cash" value={php(by("cash"))} sub="Counted at Daily close" to="/admin/finance/close" />
        <KpiCard label="QR Ph" value={php(by("qrph"))} sub="Scanned at checkout" />
        <KpiCard label="GCash + bank" value={php(by("gcash") + by("bank"))} sub={`Downpayments ${php(dp)} · finals ${php(total - dp)}`} />
      </div>

      {q.isLoading ? <LoadingState /> : rows.length === 0 ? <EmptyState title="No payments in this period" /> : (
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reservation</TableHead>
                  <TableHead className="hidden md:table-cell">Kind</TableHead>
                  <TableHead className="hidden md:table-cell">Collected by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.page.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-sm">{niceDateTime(p.created_at)}</TableCell>
                    <TableCell>
                      <Link to="/admin/bookings/$id" params={{ id: p.booking_id }} className="link-action text-sm">{p.bookings?.code}</Link>
                      <p className="text-xs text-muted-foreground">{p.bookings?.guests?.name} · {p.bookings?.cottages?.name}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      <span className="capitalize">{p.kind}</span> <MethodPill method={p.method} />
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] truncate text-xs text-muted-foreground md:table-cell">{p.created_by}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {php(signed(p))}
                      {p.edited && <Badge variant="outline" className="ml-2 rounded-full border-warning/30 bg-warning/12 text-[10px] text-warning">Edited</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {rows.length > 0 && <PaginationBar pagination={paged} noun="payments" />}
    </div>
  );
}
