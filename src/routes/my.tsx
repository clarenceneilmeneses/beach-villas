import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload01Icon } from "@hugeicons/core-free-icons";
import { AuthPanel } from "@/components/auth-panel";
import { GuestShell } from "@/components/guest-shell";
import { Badge, Button, Card, Empty, Field, Icon, Input, Select, Spinner, statusTone } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { slotTimes, useSettings, type Booking, type Payment } from "@/lib/data";
import { METHOD_LABEL, money, niceDate, niceTime, SLOT_LABEL, STATUS_LABEL } from "@/lib/format";
import { rpc, supabase, uploadReceipt } from "@/lib/supabase";

export const Route = createFileRoute("/my")({
  validateSearch: (s: Record<string, unknown>): { new?: string } => (typeof s.new === "string" ? { new: s.new } : {}),
  component: MyBookings,
});

type Row = Booking & { cottages: { name: string; cottage_types: { name: string; downpayment: number } }; payments: Payment[] };

function MyBookings() {
  const { session, ready } = useAuth();
  const { new: fresh } = Route.useSearch();
  const list = useQuery({
    queryKey: ["my-bookings", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, cottages(name, cottage_types(name, downpayment)), payments(*)")
        .eq("user_id", session!.user.id)
        .order("stay_date", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Row[];
    },
  });

  if (!ready) return <GuestShell><Spinner /></GuestShell>;
  if (!session)
    return (
      <GuestShell>
        <Card><AuthPanel hint="Sign in to see your bookings." /></Card>
      </GuestShell>
    );

  return (
    <GuestShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-neutral-500">Sign out</button>
      </div>
      <p className="text-sm text-neutral-500">{session.user.email}</p>
      <div className="mt-4 space-y-3">
        {list.isLoading ? <Spinner /> : list.data?.length ? list.data.map((b) => <BookingCard key={b.id} b={b} highlight={b.id === fresh} />) : (
          <Empty title="No bookings yet" hint="Pick a date and a cottage to book." />
        )}
      </div>
      {!list.data?.length && !list.isLoading && <Link to="/" className="mt-4 block text-center text-sm font-medium underline">Book a cottage</Link>}
    </GuestShell>
  );
}

function BookingCard({ b, highlight }: { b: Row; highlight: boolean }) {
  const settings = useSettings().data;
  const dp = b.payments.find((p) => p.kind === "downpayment" && p.status !== "rejected");
  const needsReceipt = b.status === "pending" && !dp;
  return (
    <Card className={highlight ? "ring-2 ring-neutral-900" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-neutral-500">{b.code}</p>
          <h3 className="font-semibold">{b.cottages.cottage_types.name} · {b.cottages.name}</h3>
          <p className="text-sm text-neutral-600">{niceDate(b.stay_date)} · {SLOT_LABEL[b.slot]} · {slotTimes(settings, b.slot)}</p>
          <p className="text-sm text-neutral-600">{b.pax_adults} adults{b.pax_children ? `, ${b.pax_children} kids` : ""} · estimate {money(b.estimate)}</p>
        </div>
        <Badge tone={statusTone(b.status)}>{dp?.status === "submitted" ? "Receipt sent" : STATUS_LABEL[b.status]}</Badge>
      </div>

      {needsReceipt && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Send {money(b.cottages.cottage_types.downpayment)} to keep this booking{b.hold_until ? ` — held until ${niceTime(b.hold_until)}` : ""}.</p>
          <p className="mt-2 text-amber-900">GCash: {settings?.gcash_number} ({settings?.gcash_name})</p>
          <p className="text-amber-900">{settings?.bank_name}: {settings?.bank_account_number} ({settings?.bank_account_name})</p>
          <ReceiptForm booking={b} />
        </div>
      )}
      {dp?.status === "submitted" && <p className="mt-3 text-sm text-neutral-500">We got your receipt. Staff will confirm it shortly.</p>}
      {b.payments.some((p) => p.status === "rejected") && b.status === "pending" && !dp && (
        <p className="mt-2 text-sm text-red-600">Your last receipt couldn't be verified. Please send it again or message us.</p>
      )}
    </Card>
  );
}

function ReceiptForm({ booking }: { booking: Row }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [method, setMethod] = useState("gcash");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Attach the receipt screenshot");
    setBusy(true);
    try {
      const path = await uploadReceipt(session!.user.id, file);
      await rpc("submit_receipt", { p_booking: booking.id, p_path: path, p_method: method, p_amount: booking.cottages.cottage_types.downpayment, p_reference: ref });
      toast.success("Receipt sent");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Paid by">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="gcash">{METHOD_LABEL.gcash}</option>
            <option value="bank">{METHOD_LABEL.bank}</option>
          </Select>
        </Field>
        <Field label="Reference no."><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      </div>
      <Input type="file" accept="image/*" className="h-auto py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button type="submit" className="w-full" disabled={busy}><Icon icon={Upload01Icon} size={18} /> {busy ? "Sending…" : "Send receipt"}</Button>
    </form>
  );
}
