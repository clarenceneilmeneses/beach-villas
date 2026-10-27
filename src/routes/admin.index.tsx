import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { BookingSheet, type BookingPreset } from "@/components/booking-sheet";
import { byCottage, HALF_LABEL, HALF_STYLE, halfState, Legend, useBoard, type BoardHalf } from "@/components/board";
import { Button, Card, Icon, SchemaNotice, Spinner, Stat } from "@/components/ui";
import { useStaff } from "@/lib/auth";
import { addDays, cn, manilaDayStart, manilaToday, METHOD_LABEL, money, niceDate, SLOT_LABEL, type Slot } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/")({ component: Home });

function Home() {
  const [date, setDate] = useState(manilaToday());
  const board = useBoard(date);
  const owner = useStaff().data?.role === "owner";
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<BookingPreset | null>(null);

  const open = (h: BoardHalf | undefined, cottage: string, half: "day" | "night") => {
    if (h?.booking_id) navigate({ to: "/admin/bookings/$id", params: { id: h.booking_id } });
    else setSheet({ cottage_id: cottage, date, slot: half, source: "walk_in" });
  };

  if (board.error) return <SchemaNotice error={board.error} />;
  const cottages = byCottage(board.data ?? []);
  const freeHalves = (board.data ?? []).filter((h) => !h.booking_id).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => setDate(addDays(date, -1))} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Previous day"><Icon icon={ArrowLeft01Icon} /></button>
        <button onClick={() => setDate(manilaToday())} className="text-center">
          <p className="text-lg font-semibold">{date === manilaToday() ? "Today" : niceDate(date)}</p>
          <p className="text-xs text-neutral-500">{niceDate(date, { weekday: "long", month: "long", day: "numeric" })} · {freeHalves} free slots</p>
        </button>
        <button onClick={() => setDate(addDays(date, 1))} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Next day"><Icon icon={ArrowRight01Icon} /></button>
      </div>

      <Button size="lg" className="w-full" onClick={() => setSheet({ date, source: "walk_in" })}>
        <Icon icon={Add01Icon} size={18} /> Walk-in
      </Button>

      {board.isLoading ? (
        <Spinner />
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2">
            {cottages.map((c) => (
              <div key={c.id} className="rounded-2xl border border-neutral-200 p-2">
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-[11px] text-neutral-400">{c.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Half h={c.day} label="Day" onClick={() => open(c.day, c.id, "day")} />
                  <Half h={c.night} label="Night" onClick={() => open(c.night, c.id, "night")} />
                </div>
              </div>
            ))}
          </div>
          <Legend className="mt-3" />
        </div>
      )}

      <NeedsAction owner={owner} />
      {owner && <TodayMoney />}

      <BookingSheet open={!!sheet} onClose={() => setSheet(null)} preset={sheet ?? {}} />
    </div>
  );
}

function Half({ h, label, onClick }: { h?: BoardHalf; label: string; onClick: () => void }) {
  const st = halfState(h);
  const both = h?.slot === "h22" || h?.slot === "day_night";
  return (
    <button onClick={onClick} className={cn("flex min-h-14 flex-col items-start rounded-xl px-2 py-1.5 text-left transition active:scale-95", HALF_STYLE[st])}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}{both ? ` · ${SLOT_LABEL[h!.slot as Slot]}` : ""}</span>
      <span className="line-clamp-1 text-xs font-medium">{st === "free" ? "Free" : st === "blocked" ? h?.block_reason : h?.guest_name}</span>
      {st !== "free" && st !== "blocked" && <span className="text-[10px] opacity-70">{HALF_LABEL[st]}{h?.pax ? ` · ${h.pax} pax` : ""}</span>}
    </button>
  );
}

function NeedsAction({ owner }: { owner: boolean }) {
  const q = useQuery({
    queryKey: ["needs-action", owner],
    queryFn: async () => {
      const today = manilaToday();
      const [receipts, unsettled, unread, edits] = await Promise.all([
        supabase.from("payments").select("id, amount, method, booking_id, bookings(code, guests(name))").eq("status", "submitted").order("created_at"),
        supabase.from("bookings").select("id, code, guests(name)").not("checked_out_at", "is", null).in("status", ["confirmed", "checked_in"]),
        supabase.from("threads").select("id, guests(name), channel").eq("unread", true),
        owner
          ? supabase.from("payment_edits").select("id, old_amount, new_amount, edited_by, payments(booking_id, bookings(code))").gte("edited_at", manilaDayStart(today))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      return { receipts: receipts.data ?? [], unsettled: unsettled.data ?? [], unread: unread.data ?? [], edits: (edits as any).data ?? [] };
    },
  });
  const d = q.data;
  const items = d ? d.receipts.length + d.unsettled.length + d.unread.length + d.edits.length : 0;

  return (
    <section>
      <h2 className="mb-2 font-semibold">Needs action {items ? <span className="text-neutral-400">· {items}</span> : null}</h2>
      {!d ? <Spinner /> : items === 0 ? (
        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">All clear.</p>
      ) : (
        <div className="space-y-2">
          {d.receipts.map((p: any) => (
            <ActionRow key={p.id} to={`/admin/bookings/${p.booking_id}`} title={`Verify ${money(p.amount)} ${METHOD_LABEL[p.method]}`} sub={`${p.bookings?.code} · ${p.bookings?.guests?.name ?? ""}`} action="Verify" />
          ))}
          {d.unsettled.map((b: any) => (
            <ActionRow key={b.id} to={`/admin/bookings/${b.id}`} title="Checked out, not settled" sub={`${b.code} · ${b.guests?.name ?? ""}`} action="Settle" />
          ))}
          {d.unread.map((t: any) => (
            <ActionRow key={t.id} to={`/admin/inbox?t=${t.id}`} title={`Unread ${t.channel === "messenger" ? "Messenger" : t.channel} chat`} sub={t.guests?.name ?? ""} action="Reply" />
          ))}
          {d.edits.map((e: any) => (
            <ActionRow key={e.id} to={`/admin/bookings/${e.payments?.booking_id}`} title={`Payment edited ${money(e.old_amount)} → ${money(e.new_amount)}`} sub={`${e.payments?.bookings?.code} · by ${e.edited_by}`} action="View" />
          ))}
        </div>
      )}
    </section>
  );
}

function ActionRow({ to, title, sub, action }: { to: string; title: string; sub: string; action: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.history.push(to)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-left">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-neutral-500">{sub}</p>
      </div>
      <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">{action}</span>
    </button>
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
      const by = { cash: 0, gcash: 0, bank: 0 } as Record<string, number>;
      for (const p of pay.data ?? []) by[p.method] = (by[p.method] ?? 0) + (p.kind === "refund" ? -1 : 1) * Number(p.amount);
      const discount = (settled.data ?? []).reduce((s, b) => s + Math.max(0, Number(b.estimate) - Number(b.final_amount ?? 0)), 0);
      return { by, total: Object.values(by).reduce((a, b) => a + b, 0), discount };
    },
  });
  return (
    <section>
      <h2 className="mb-2 font-semibold">Today's money</h2>
      <Card className="grid grid-cols-2 gap-2 p-2">
        <Stat label="Collected" value={money(q.data?.total)} />
        <Stat label="Discounts given" value={money(q.data?.discount)} />
        <Stat label="Cash" value={money(q.data?.by.cash)} />
        <Stat label="GCash + bank" value={money((q.data?.by.gcash ?? 0) + (q.data?.by.bank ?? 0))} />
      </Card>
    </section>
  );
}
