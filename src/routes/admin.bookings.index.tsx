import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { BookingSheet } from "@/components/booking-sheet";
import { Badge, Button, Card, Empty, Icon, Input, SchemaNotice, Segmented, Select, Spinner, statusTone } from "@/components/ui";
import { addDays, manilaToday, METHOD_LABEL, money, niceDate, niceDateTime, SLOT_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/format";
import { rpc, signedUrl, supabase } from "@/lib/supabase";

type Tab = "requests" | "today" | "all" | "guests";

export const Route = createFileRoute("/admin/bookings/")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (["requests", "today", "all", "guests"].includes(String(s.tab)) ? s.tab : "today") as Tab }),
  component: Bookings,
});

const BOOKING_COLS = "id, code, stay_date, slot, status, source, pax_adults, pax_children, estimate, final_amount, checked_out_at, cottages(name), guests(name, mobile)";

function Bookings() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const [add, setAdd] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <Button onClick={() => setAdd(true)}><Icon icon={Add01Icon} size={18} /> Add</Button>
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={(t) => navigate({ to: "/admin/bookings", search: { tab: t } })}
        options={[{ value: "today", label: "Today" }, { value: "requests", label: "Requests" }, { value: "all", label: "All" }, { value: "guests", label: "Guests" }]}
      />
      {tab === "requests" && <Requests />}
      {tab === "today" && <Today />}
      {tab === "all" && <All />}
      {tab === "guests" && <Guests />}
      <BookingSheet open={add} onClose={() => setAdd(false)} preset={{ source: "messenger" }} />
    </div>
  );
}

export function BookingRow({ b }: { b: any }) {
  return (
    <Link to="/admin/bookings/$id" params={{ id: b.id }} className="block rounded-2xl border border-neutral-200 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{b.guests?.name ?? "—"} <span className="text-xs font-normal text-neutral-400">{b.code}</span></p>
          <p className="text-sm text-neutral-500">{b.cottages?.name} · {niceDate(b.stay_date)} · {SLOT_LABEL[b.slot as keyof typeof SLOT_LABEL]}</p>
          <p className="text-xs text-neutral-400">{SOURCE_LABEL[b.source]} · {b.pax_adults + b.pax_children} pax · {money(b.final_amount ?? b.estimate)}</p>
        </div>
        <Badge tone={b.checked_out_at && b.status !== "settled" ? "amber" : statusTone(b.status)}>
          {b.checked_out_at && b.status !== "settled" ? "To settle" : STATUS_LABEL[b.status]}
        </Badge>
      </div>
    </Link>
  );
}

function Requests() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`id, amount, method, reference, receipt_path, created_at, booking_id, bookings(${BOOKING_COLS})`)
        .eq("status", "submitted")
        .order("created_at");
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  async function decide(id: string, ok: boolean) {
    try {
      await rpc("verify_payment", { p_payment: id, p_ok: ok });
      toast.success(ok ? "Verified, booking confirmed" : "Rejected, guest can resend");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (q.error) return <SchemaNotice error={q.error} />;
  if (q.isLoading) return <Spinner />;
  if (!q.data?.length) return <Empty title="No receipts to verify" hint="Online bookings with a downpayment receipt show up here." />;
  return (
    <div className="space-y-3">
      {q.data.map((p) => (
        <Card key={p.id} className="space-y-3">
          <BookingRow b={p.bookings} />
          <div className="flex items-center justify-between text-sm">
            <span>{money(p.amount)} {METHOD_LABEL[p.method]} {p.reference && <span className="text-neutral-500">· {p.reference}</span>}</span>
            <span className="text-xs text-neutral-400">{niceDateTime(p.created_at)}</span>
          </div>
          <div className="flex gap-2">
            <Button tone="outline" size="sm" onClick={async () => { const u = await signedUrl(p.receipt_path); u ? window.open(u, "_blank") : toast.error("No receipt file"); }}>View receipt</Button>
            <div className="flex-1" />
            <Button tone="danger" size="sm" onClick={() => decide(p.id, false)}>Reject</Button>
            <Button tone="success" size="sm" onClick={() => decide(p.id, true)}>Verify</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Today() {
  const today = manilaToday();
  const q = useQuery({
    queryKey: ["bookings-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKING_COLS)
        .gte("stay_date", addDays(today, -1))
        .lte("stay_date", today)
        .in("status", ["pending", "confirmed", "checked_in", "settled"])
        .order("stay_date");
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  if (q.error) return <SchemaNotice error={q.error} />;
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  const toSettle = rows.filter((b) => b.checked_out_at && b.status !== "settled");
  const inHouse = rows.filter((b) => b.status === "checked_in" && !b.checked_out_at);
  const arriving = rows.filter((b) => b.stay_date === today && (b.status === "confirmed" || b.status === "pending"));
  const settled = rows.filter((b) => b.status === "settled" && b.stay_date === today);
  return (
    <div className="space-y-5">
      <Group title="To settle" rows={toSettle} empty="Nobody waiting to settle." />
      <Group title="In house" rows={inHouse} empty="No guests checked in." />
      <Group title="Arriving today" rows={arriving} empty="No more arrivals today." />
      {settled.length > 0 && <Group title="Settled today" rows={settled} empty="" />}
    </div>
  );
}

const Group = ({ title, rows, empty }: { title: string; rows: any[]; empty: string }) => (
  <section>
    <h2 className="mb-2 text-sm font-semibold text-neutral-500">{title} · {rows.length}</h2>
    {rows.length ? <div className="space-y-2">{rows.map((b) => <BookingRow key={b.id} b={b} />)}</div> : <p className="text-sm text-neutral-400">{empty}</p>}
  </section>
);

function All() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(50);
  const q = useQuery({
    queryKey: ["bookings-all", search, status, limit],
    queryFn: async () => {
      let query = supabase.from("bookings").select(BOOKING_COLS).neq("status", "blocked").order("stay_date", { ascending: false }).limit(limit);
      if (status) query = query.eq("status", status);
      const s = search.trim();
      if (s) {
        const { data: g } = await supabase.from("guests").select("id").or(`name.ilike.%${s}%,mobile.ilike.%${s}%`).limit(100);
        const ids = (g ?? []).map((x) => x.id);
        query = query.or(`code.ilike.%${s}%${ids.length ? `,guest_id.in.(${ids.join(",")})` : ""}`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input placeholder="Name, mobile or BK- number" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          {["pending", "confirmed", "checked_in", "settled", "cancelled", "no_show", "expired"].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      </div>
      {q.error ? <SchemaNotice error={q.error} /> : q.isLoading ? <Spinner /> : q.data?.length ? (
        <>
          <div className="space-y-2">{q.data.map((b) => <BookingRow key={b.id} b={b} />)}</div>
          {q.data.length === limit && <Button tone="outline" className="w-full" onClick={() => setLimit(limit + 50)}>Load 50 more</Button>}
        </>
      ) : <Empty title="No bookings match" />}
    </div>
  );
}

function Guests() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["guests", search],
    queryFn: async () => {
      let query = supabase.from("guests").select("id, name, mobile, email, bookings(count)").order("created_at", { ascending: false }).limit(50);
      if (search.trim()) query = query.or(`name.ilike.%${search.trim()}%,mobile.ilike.%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  return (
    <div className="space-y-3">
      <Input placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
      {q.isLoading ? <Spinner /> : (
        <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {q.data?.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{g.name}</p>
                <p className="text-sm text-neutral-500">{g.mobile || g.email || "No contact"}</p>
              </div>
              <span className="text-sm text-neutral-500">{g.bookings?.[0]?.count ?? 0} visits</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
