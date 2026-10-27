import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "@/components/icons";
import { byCottage, Half, Legend, useBoard, type BoardHalf } from "@/components/obs/board";
import { useBookingDialog } from "@/components/obs/booking-dialog";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStaff } from "@/lib/auth";
import { addDays, manilaDayStart, manilaToday, METHOD_LABEL, niceDate, php } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const [date, setDate] = useState(manilaToday());
  const board = useBoard(date);
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
  const rows = board.data ?? [];
  const cottages = byCottage(rows);
  const free = rows.filter((h) => !h.booking_id).length;
  const inHouse = new Set(rows.filter((h) => h.status === "checked_in" && !h.checked_out_at).map((h) => h.booking_id)).size;
  const arriving = new Set(rows.filter((h) => h.status === "confirmed").map((h) => h.booking_id)).size;
  const pending = new Set(rows.filter((h) => h.status === "pending").map((h) => h.booking_id)).size;

  return (
    <div className="space-y-8">
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section>
          <SectionHeading eyebrow="14 cottages · tap a free half to book" title="Cottage board" action={<Button onClick={() => booking.open({ date, source: "walk_in" })}>Walk-in</Button>} />
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

        <div className="space-y-6">
          <NeedsAction owner={owner} />
          {owner && <TodayMoney />}
        </div>
      </div>
    </div>
  );
}

function NeedsAction({ owner }: { owner: boolean }) {
  const q = useQuery({
    queryKey: ["needs-action", owner],
    queryFn: async () => {
      const [receipts, unsettled, unread, edits] = await Promise.all([
        supabase.from("payments").select("id, amount, method, booking_id, bookings(code, guests(name))").eq("status", "submitted").order("created_at"),
        supabase.from("bookings").select("id, code, guests(name)").not("checked_out_at", "is", null).in("status", ["confirmed", "checked_in"]),
        supabase.from("threads").select("id, channel, guests(name)").eq("unread", true),
        owner
          ? supabase.from("payment_edits").select("id, old_amount, new_amount, edited_by, payments(booking_id, bookings(code))").gte("edited_at", manilaDayStart(manilaToday()))
          : Promise.resolve({ data: [] as unknown[] }),
      ]);
      const items: { key: string; to: string; title: string; sub: string; action: string }[] = [];
      for (const p of (receipts.data ?? []) as any[]) items.push({ key: p.id, to: `/admin/bookings/${p.booking_id}`, title: `Verify ${php(p.amount)} ${METHOD_LABEL[p.method]}`, sub: `${p.bookings?.code} · ${p.bookings?.guests?.name ?? ""}`, action: "Verify" });
      for (const b of (unsettled.data ?? []) as any[]) items.push({ key: b.id, to: `/admin/bookings/${b.id}`, title: "Checked out, not settled", sub: `${b.code} · ${b.guests?.name ?? ""}`, action: "Settle" });
      for (const t of (unread.data ?? []) as any[]) items.push({ key: t.id, to: `/admin/inbox?t=${t.id}`, title: `Unread ${t.channel === "messenger" ? "Messenger" : t.channel === "whatsapp" ? "WhatsApp" : "Viber"} chat`, sub: t.guests?.name ?? "", action: "Reply" });
      for (const e of ((edits as any).data ?? []) as any[]) items.push({ key: e.id, to: `/admin/bookings/${e.payments?.booking_id}`, title: `Payment edited ${php(e.old_amount)} → ${php(e.new_amount)}`, sub: `${e.payments?.bookings?.code} · by ${e.edited_by}`, action: "View" });
      return items;
    },
  });
  const router = useRouter();
  return (
    <section>
      <SectionHeading eyebrow={q.data ? `${q.data.length} waiting` : "Checking…"} title="Needs action" />
      <Card className="border-border/70 bg-surface shadow-level-2">
        <CardContent className="p-2">
          {!q.data ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : q.data.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">All clear — nothing waiting on anyone.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {q.data.map((i) => (
                <li key={i.key}>
                  <button onClick={() => router.history.push(i.to)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{i.sub}</span>
                    </span>
                    <span className="link-action inline-flex shrink-0 items-center gap-1 text-xs font-semibold">{i.action} <ArrowRight className="size-3.5" /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
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
      const by: Record<string, number> = { cash: 0, gcash: 0, bank: 0 };
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
            {(["cash", "gcash", "bank"] as const).map((m) => (
              <div key={m} className="rounded-lg bg-secondary/70 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">{METHOD_LABEL[m]}</p>
                <p className="text-sm font-semibold tabular-nums">{php(d?.by[m])}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Discounts given on settled stays today: <span className="font-medium text-foreground">{php(d?.discount)}</span></p>
        </CardContent>
      </Card>
    </section>
  );
}
