import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/obs/app-shell";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ChartCard, DailyBars, HBars } from "@/components/obs/finance-charts";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { useCottages } from "@/lib/data";
import { useSummary } from "@/lib/finance";
import { scopedCottages, useFilters } from "@/lib/filters";
import { METHOD_LABEL, php, SLOT_LABEL, type Slot } from "@/lib/format";

export const Route = createFileRoute("/admin/finance/")({ component: () => <OwnerOnly><Overview /></OwnerOnly> });

/**
 * Finance at a glance for the top bar's cottages and dates: the totals as
 * stat cards, then where the money came from and went. Every figure comes
 * from finance_summary in the database, so a busy month is never cut short.
 */
function Overview() {
  const { filters, range } = useFilters();
  const scope = scopedCottages(filters.scope, useCottages().data ?? []);
  const q = useSummary(range.from, range.to, scope);
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <LoadingState />;
  const s = q.data;
  const collected = Number(s.collected);
  const expenses = Number(s.expenses);
  const net = collected - expenses;
  const occupancy = s.capacity ? Math.round((Number(s.halves) / s.capacity) * 100) : 0;
  const perBooking = s.bookings ? collected / s.bookings : 0;
  const topCategory = s.by_category[0];
  const count = (n: number) => String(n);

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Overview · ${range.span}`} title="How the resort is doing" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Collected" value={php(collected)} sub={`${s.payments} payments`} to="/admin/finance/collections" />
        <KpiCard label="Expenses" value={php(expenses)} sub={topCategory ? `Most on ${topCategory.category}` : "Nothing spent"} to="/admin/finance/expenses" />
        <KpiCard label="Net" value={php(net)} sub={collected ? `${Math.round((net / collected) * 100)}% of what came in` : "Collected minus expenses"} />
        <KpiCard label="Discounts given" value={php(s.discounts)} sub={`On ${s.settled} settled stay${s.settled === 1 ? "" : "s"}`} />
        <KpiCard label="Bookings" value={count(s.bookings)} sub={`${s.cancelled} cancelled or no-show`} to="/admin/bookings" />
        <KpiCard label="Occupancy" value={`${occupancy}%`} sub={`${s.halves} of ${s.capacity} halves`} to="/admin/finance/cottages" />
        <KpiCard label="Per booking" value={php(Math.round(perBooking))} sub="Collected ÷ bookings" />
        <KpiCard label="Refunds" value={php(s.refunds)} sub="Paid back to guests" />
      </div>

      <ChartCard title="Money in by day" sub="Verified payments, by the day they were made. Hover a day for the figure." figure={php(collected)}>
        <DailyBars data={s.daily} />
      </ChartCard>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <ChartCard title="How guests paid" figure={php(collected)}>
          <HBars items={s.by_method.map((m) => ({ label: METHOD_LABEL[m.method] ?? m.method, value: Number(m.total) }))} />
        </ChartCard>
        <ChartCard title="Where the money went" figure={php(expenses)}>
          <HBars items={s.by_category.map((c) => ({ label: c.category, value: Number(c.total) }))} empty="No expenses in this period." />
        </ChartCard>
        <ChartCard title="Stays by type" figure={`${s.bookings} stays`}>
          <HBars items={s.by_slot.map((x) => ({ label: SLOT_LABEL[x.slot as Slot] ?? x.slot, value: Number(x.n) }))} format={(n) => `${n} stay${n === 1 ? "" : "s"}`} empty="No stays in this period." />
        </ChartCard>
        <ChartCard title="Top cottages" sub="By money collected">
          <HBars
            items={[...s.cottages].sort((a, b) => Number(b.collected) - Number(a.collected)).filter((c) => Number(c.collected) > 0).slice(0, 8).map((c) => ({ label: c.name, value: Number(c.collected), hint: `${c.bookings} bookings` }))}
            empty="No money collected yet in this period."
          />
        </ChartCard>
      </div>
    </div>
  );
}
