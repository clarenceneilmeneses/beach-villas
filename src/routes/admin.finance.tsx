import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Empty, Field, Input, SchemaNotice, Segmented, Select, Spinner, Stat } from "@/components/ui";
import { useStaff } from "@/lib/auth";
import { useCottages } from "@/lib/data";
import { addDays, halvesOf, manilaDayStart, manilaToday, METHOD_LABEL, money, niceDate, niceDateTime, type Slot } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/finance")({ component: Finance });

type Tab = "collections" | "close" | "expenses" | "cottages";
type Period = "today" | "7d" | "month";

function range(p: Period) {
  const today = manilaToday();
  const from = p === "today" ? today : p === "7d" ? addDays(today, -6) : `${today.slice(0, 8)}01`;
  return { from, to: today, days: Math.round((Date.parse(today) - Date.parse(from)) / 864e5) + 1 };
}

function Finance() {
  const staff = useStaff().data;
  const [tab, setTab] = useState<Tab>("collections");
  const [period, setPeriod] = useState<Period>("month");
  if (staff?.role !== "owner") return <Empty title="Finance is for the owner" />;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Finance</h1>
      <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: "collections", label: "Collections" }, { value: "close", label: "Daily close" }, { value: "expenses", label: "Expenses" }, { value: "cottages", label: "Per cottage" }]} />
      {tab !== "close" && (
        <Segmented<Period> value={period} onChange={setPeriod} className="max-w-xs" options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "month", label: "This month" }]} />
      )}
      {tab === "collections" && <Collections period={period} />}
      {tab === "close" && <DailyClose />}
      {tab === "expenses" && <Expenses period={period} />}
      {tab === "cottages" && <PerCottage period={period} />}
    </div>
  );
}

function usePayments(from: string, to: string) {
  return useQuery({
    queryKey: ["payments", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, kind, method, amount, status, created_by, created_at, edited, bookings(code, cottages(name))")
        .eq("status", "verified")
        .gte("created_at", manilaDayStart(from))
        .lt("created_at", manilaDayStart(addDays(to, 1)))
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
}

const signed = (p: any) => (p.kind === "refund" ? -1 : 1) * Number(p.amount);

function Collections({ period }: { period: Period }) {
  const { from, to } = range(period);
  const q = usePayments(from, to);
  if (q.error) return <SchemaNotice error={q.error} />;
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  const by = (m: string) => rows.filter((p) => p.method === m).reduce((s, p) => s + signed(p), 0);
  const total = rows.reduce((s, p) => s + signed(p), 0);
  return (
    <div className="space-y-3">
      <Card className="grid grid-cols-2 gap-2 p-2">
        <Stat label="Collected" value={money(total)} hint={`${rows.length} payments`} />
        <Stat label="Cash" value={money(by("cash"))} />
        <Stat label="GCash" value={money(by("gcash"))} />
        <Stat label="Bank" value={money(by("bank"))} />
      </Card>
      <div className="flex justify-end"><Button size="sm" tone="outline" onClick={() => csv(`collections-${from}-${to}.csv`, rows.map((p) => ({ date: p.created_at, booking: p.bookings?.code, cottage: p.bookings?.cottages?.name, kind: p.kind, method: p.method, amount: p.amount, staff: p.created_by, edited: p.edited })))}>Export CSV</Button></div>
      {rows.length === 0 ? <Empty title="No payments in this period" /> : (
        <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.bookings?.code} · {p.bookings?.cottages?.name}</p>
                <p className="text-xs text-neutral-500">{niceDateTime(p.created_at)} · {p.kind} · {METHOD_LABEL[p.method]} · {p.created_by}</p>
              </div>
              <div className="flex items-center gap-2">
                {p.edited && <Badge tone="amber">Edited</Badge>}
                <span className="font-semibold tabular-nums">{money(signed(p))}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DailyClose() {
  const today = manilaToday();
  const qc = useQueryClient();
  const q = usePayments(today, today);
  const closed = useQuery({ queryKey: ["close", today], queryFn: async () => (await supabase.from("daily_closes").select("*").eq("close_date", today).maybeSingle()).data });
  const [counted, setCounted] = useState<number | "">("");
  const [note, setNote] = useState("");
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  const staffNames = [...new Set(rows.map((p) => p.created_by ?? "—"))];
  const cash = rows.filter((p) => p.method === "cash").reduce((s, p) => s + signed(p), 0);

  async function close() {
    const { error } = await supabase.from("daily_closes").upsert({ close_date: today, cash_counted: Number(counted), cash_expected: cash, note, closed_by: (await supabase.auth.getUser()).data.user?.email });
    if (error) return toast.error(error.message);
    toast.success("Day closed");
    qc.invalidateQueries({ queryKey: ["close"] });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">{niceDate(today, { weekday: "long", month: "long", day: "numeric" })}</p>
      <div className="overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr><th className="p-2 text-left font-medium">Staff</th>{(["cash", "gcash", "bank"] as const).map((m) => <th key={m} className="p-2 text-right font-medium">{METHOD_LABEL[m]}</th>)}</tr>
          </thead>
          <tbody>
            {staffNames.map((s) => (
              <tr key={s} className="border-t border-neutral-100">
                <td className="p-2">{s}</td>
                {(["cash", "gcash", "bank"] as const).map((m) => <td key={m} className="p-2 text-right tabular-nums">{money(rows.filter((p) => p.created_by === s && p.method === m).reduce((a, p) => a + signed(p), 0))}</td>)}
              </tr>
            ))}
            {staffNames.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-neutral-400">No payments today yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Card className="space-y-3">
        <div className="flex justify-between text-sm"><span className="text-neutral-500">Cash that should be on hand</span><span className="font-semibold tabular-nums">{money(cash)}</span></div>
        {closed.data ? (
          <p className="text-sm">Closed by {closed.data.closed_by}: counted {money(closed.data.cash_counted)}{Number(closed.data.cash_counted) !== Number(closed.data.cash_expected) && <span className="text-red-600"> · short {money(Number(closed.data.cash_expected) - Number(closed.data.cash_counted))}</span>}</p>
        ) : (
          <>
            <Field label="Cash counted"><Input type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
            {counted !== "" && counted !== cash && <p className="text-sm text-red-600">{counted < cash ? "Short" : "Over"} by {money(Math.abs(cash - counted))}</p>}
            <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <Button className="w-full" disabled={counted === ""} onClick={close}>Close the day</Button>
          </>
        )}
      </Card>
    </div>
  );
}

const CATEGORIES = ["Utilities", "Staff", "Supplies", "Repairs", "Laundry", "Other"];

function Expenses({ period }: { period: Period }) {
  const { from, to } = range(period);
  const qc = useQueryClient();
  const cottages = useCottages().data ?? [];
  const q = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: async () => (await supabase.from("expenses").select("*, cottages(name)").gte("spent_on", from).lte("spent_on", to).order("spent_on", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ spent_on: manilaToday(), category: "Supplies", amount: "", cottage_id: "", note: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("expenses").insert({ ...form, amount: Number(form.amount), cottage_id: form.cottage_id || null, created_by: (await supabase.auth.getUser()).data.user?.email });
    if (error) return toast.error(error.message);
    setForm({ ...form, amount: "", note: "" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }
  const total = (q.data ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={add} className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} /></Field>
          <Field label="Amount"><Input required type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="For"><Select value={form.cottage_id} onChange={(e) => setForm({ ...form, cottage_id: e.target.value })}><option value="">Whole resort</option>{cottages.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Note" className="col-span-2"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2">Add expense</Button>
        </form>
      </Card>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Total {money(total)}</p>
        <Button size="sm" tone="outline" onClick={() => csv(`expenses-${from}-${to}.csv`, (q.data ?? []).map((x: any) => ({ date: x.spent_on, category: x.category, for: x.cottages?.name ?? "Resort", amount: x.amount, note: x.note, by: x.created_by })))}>Export CSV</Button>
      </div>
      <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
        {(q.data ?? []).map((x: any) => (
          <div key={x.id} className="flex justify-between px-4 py-2.5 text-sm">
            <div><p className="font-medium">{x.category} · {x.cottages?.name ?? "Resort"}</p><p className="text-xs text-neutral-500">{niceDate(x.spent_on)} · {x.note}</p></div>
            <span className="font-semibold tabular-nums">{money(x.amount)}</span>
          </div>
        ))}
        {!q.data?.length && <p className="p-4 text-center text-sm text-neutral-400">No expenses in this period.</p>}
      </div>
    </div>
  );
}

function PerCottage({ period }: { period: Period }) {
  const { from, to, days } = range(period);
  const cottages = useCottages().data ?? [];
  const q = useQuery({
    queryKey: ["per-cottage", from, to],
    queryFn: async () => {
      const [b, e] = await Promise.all([
        supabase.from("bookings").select("cottage_id, slot, status, estimate, final_amount, payments(amount, kind, status)").gte("stay_date", from).lte("stay_date", to).in("status", ["confirmed", "checked_in", "settled", "no_show", "cancelled"]),
        supabase.from("expenses").select("cottage_id, amount").gte("spent_on", from).lte("spent_on", to),
      ]);
      return { bookings: (b.data ?? []) as any[], expenses: (e.data ?? []) as any[] };
    },
  });
  if (q.isLoading) return <Spinner />;
  const data = cottages.map((c) => {
    const bs = q.data!.bookings.filter((b) => b.cottage_id === c.id);
    const occupied = bs.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
    const collected = bs.reduce((s, b) => s + (b.payments ?? []).filter((p: any) => p.status === "verified").reduce((a: number, p: any) => a + signed(p), 0), 0);
    const discount = bs.filter((b) => b.status === "settled").reduce((s, b) => s + Math.max(0, Number(b.estimate) - Number(b.final_amount ?? 0)), 0);
    const expenses = q.data!.expenses.filter((x) => x.cottage_id === c.id).reduce((s, x) => s + Number(x.amount), 0);
    const halves = occupied.reduce((s, b) => s + halvesOf(b.slot as Slot), 0);
    return { c, day: occupied.filter((b) => b.slot === "day").length, night: occupied.filter((b) => b.slot === "night" || b.slot === "day_night").length, h22: occupied.filter((b) => b.slot === "h22").length, occ: Math.round((halves / (days * 2)) * 100), collected, discount, expenses, net: collected - expenses };
  });
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-neutral-50 text-xs text-neutral-500">
          <tr>{["Cottage", "Day", "Night", "22h", "Occ.", "Collected", "Discounts", "Expenses", "Net"].map((h) => <th key={h} className="p-2 text-right font-medium first:text-left">{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.c.id} className="border-t border-neutral-100 tabular-nums">
              <td className="p-2 font-medium">{r.c.name}</td>
              <td className="p-2 text-right">{r.day}</td>
              <td className="p-2 text-right">{r.night}</td>
              <td className="p-2 text-right">{r.h22}</td>
              <td className="p-2 text-right">{r.occ}%</td>
              <td className="p-2 text-right">{money(r.collected)}</td>
              <td className="p-2 text-right">{money(r.discount)}</td>
              <td className="p-2 text-right">{money(r.expenses)}</td>
              <td className="p-2 text-right font-semibold">{money(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-2 text-xs text-neutral-500">Occupancy counts day and night halves; a 22-hour or extended stay counts as two. Resort-wide expenses aren't split per cottage.</p>
    </div>
  );
}

function csv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return toast.error("Nothing to export");
  const keys = Object.keys(rows[0]!);
  const body = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = name;
  a.click();
}
