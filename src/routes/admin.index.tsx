import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "@/components/icons";
import { byCottage, Half, Legend, useBoard, type BoardHalf } from "@/components/obs/board";
import { useBookingDialog } from "@/components/obs/booking-dialog";
import { ActionStrip } from "@/components/obs/action-strip";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStaff } from "@/lib/auth";
import { useCottages } from "@/lib/data";
import { scopedCottages, useFilters } from "@/lib/filters";
import { addDays, manilaDayStart, manilaToday, METHOD_LABEL, niceDate, php } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const [date, setDate] = useState(manilaToday());
  const board = useBoard(date);
  const { filters } = useFilters();
  const allCottages = useCottages().data ?? [];
  const owner = useStaff().data?.role === "owner";
  const navigate = useNavigate();
  const booking = useBookingDialog();
  const today = manilaToday();

  const open = (h: BoardHalf | undefined, cottage: string, half: "day" | "night") => {
    if (h?.booking_id) navigate({ to: "/admin/bookings/$id", params: { id: h.booking_id } });
    else booking.open({ cottage_id: cottage, date, slot: half, source: date === today ? "walk_in" : "messenger" });
  };

  if (board.error) return <ErrorState error={board.error} onRetry={() => board.refetch()} />;
  if (board.isLoading) return <LoadingState />;
  const scope = scopedCottages(filters.scope, allCottages);
  const rows = (board.data ?? []).filter((h) => !scope || scope.has(h.cottage_id));
  const cottages = byCottage(rows);
  const free = rows.filter((h) => !h.booking_id).length;
  const inHouse = new Set(rows.filter((h) => h.status === "checked_in" && !h.checked_out_at).map((h) => h.booking_id)).size;
  const arriving = new Set(rows.filter((h) => h.status === "confirmed").map((h) => h.booking_id)).size;
  const pending = new Set(rows.filter((h) => h.status === "pending").map((h) => h.booking_id)).size;

  return (
    <div className="space-y-8">
      <ActionStrip />

      <section>
        <SectionHeading
          eyebrow={date === today ? `Today · ${niceDate(date, { weekday: "long", month: "long", day: "numeric" })}` : niceDate(date, { weekday: "long", month: "long", day: "numeric" })}
          title="The resort at a glance"
          action={
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card p-0.5 shadow-level-1">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="size-4" /></Button>
              <Button variant="ghost" className="rounded-full px-3" onClick={() => setDate(today)}>Today</Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="size-4" /></Button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard label="Free slots" value={`${free} of ${rows.length}`} sub="Day and night halves" to="/admin/calendar" />
          <KpiCard label="In house" value={String(inHouse)} sub="Checked in, not out" to="/admin/bookings/today" />
          <KpiCard label="Arriving" value={String(arriving)} sub="Confirmed for this date" to="/admin/bookings/today" />
          <KpiCard label="Pending downpayment" value={String(pending)} sub="Online, held for the guest" to="/admin/bookings/requests" />
        </div>
      </section>

      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-6", owner && "xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]")}>
        <section>
          <SectionHeading eyebrow={`${new Set(rows.map((h) => h.cottage_id)).size} cottages · tap a free half to book`} title="Cottage board" action={<Button onClick={() => booking.open({ date, source: "walk_in" })}>Walk-in</Button>} />
          <Card className="border-border/70 bg-surface shadow-level-2">
            <CardContent className="p-4">
              <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                {cottages.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border/70 bg-card p-2">
                    <div className="mb-1.5 flex items-baseline justify-between px-1">
                      <span className="font-display text-sm">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground">{c.type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Half h={c.day} label="Day" onClick={() => open(c.day, c.id, "day")} />
                      <Half h={c.night} label="Night" onClick={() => open(c.night, c.id, "night")} />
                    </div>
                  </div>
                ))}
              </div>
              <Legend className="mt-4" />
            </CardContent>
          </Card>
        </section>

        {owner && (
          <div className="space-y-6">
            <TodayMoney />
          </div>
        )}
      </div>
    </div>
  );
}

function TodayMoney() {
  const today = manilaToday();
  const q = useQuery({
    queryKey: ["today-money", today],
    queryFn: async () => {
      const [pay, settled] = await Promise.all([
        supabase.from("payments").select("amount, method, kind").eq("status", "verified").gte("created_at", manilaDayStart(today)),
        supabase.from("bookings").select("estimate, final_amount").eq("status", "settled").gte("checked_out_at", manilaDayStart(today)),
      ]);
      const by: Record<string, number> = { cash: 0, qrph: 0, gcash: 0, bank: 0 };
      for (const p of pay.data ?? []) by[p.method] = (by[p.method] ?? 0) + (p.kind === "refund" ? -1 : 1) * Number(p.amount);
      const discount = (settled.data ?? []).reduce((s, b) => s + Math.max(0, Number(b.estimate) - Number(b.final_amount ?? 0)), 0);
      return { by, total: Object.values(by).reduce((a, b) => a + b, 0), discount };
    },
  });
  const d = q.data;
  return (
    <section>
      <SectionHeading eyebrow="Owner only" title="Today's money" />
      <Card className="border-border/70 bg-surface shadow-level-2">
        <CardContent className="space-y-3 p-5">
          <p className="malaya-eyebrow">Collected today</p>
          <p className="font-display text-[28px] leading-tight">{php(d?.total)}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["cash", "qrph", "gcash"] as const).map((m) => (
              <div key={m} className="rounded-lg bg-secondary/70 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">{m === "gcash" ? "GCash/bank" : METHOD_LABEL[m]}</p>
                <p className="text-sm font-semibold tabular-nums">{php(m === "gcash" ? (d?.by.gcash ?? 0) + (d?.by.bank ?? 0) : d?.by[m])}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Discounts given on settled stays today: <span className="font-medium text-foreground">{php(d?.discount)}</span></p>
        </CardContent>
      </Card>
    </section>
  );
}
