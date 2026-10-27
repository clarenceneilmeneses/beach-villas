import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft01Icon, Call02Icon } from "@hugeicons/core-free-icons";
import { Badge, Button, Card, Field, Icon, Input, Select, Sheet, Spinner, statusTone, Textarea } from "@/components/ui";
import { slotTimes, useCottages, useCottageTypes, useSettings, type Payment } from "@/lib/data";
import { METHOD_LABEL, money, niceDate, niceDateTime, SLOT_LABEL, SOURCE_LABEL, STATUS_LABEL, type Slot } from "@/lib/format";
import { rpc, signedUrl, supabase, uploadReceipt } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings/$id")({ component: Detail });

type PaymentRow = Payment & { payment_edits: { id: string; old_amount: number; new_amount: number; reason: string; edited_by: string; edited_at: string }[] };

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const settings = useSettings().data;
  const [sheet, setSheet] = useState<null | "settle" | "edit" | "move" | "cancel" | { pay: PaymentRow }>(null);
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const [b, log] = await Promise.all([
        supabase.from("bookings").select("*, cottages(name, type_id, cottage_types(name, downpayment)), guests(*), payments(*, payment_edits(*))").eq("id", id).single(),
        supabase.from("activity_log").select("*").eq("booking_id", id).order("at", { ascending: false }).limit(30),
      ]);
      if (b.error) throw new Error(b.error.message);
      return { b: b.data as any, log: log.data ?? [] };
    },
  });

  async function act(fn: string, args: Record<string, unknown>, ok: string) {
    try {
      await rpc(fn, args);
      toast.success(ok);
      qc.invalidateQueries();
      setSheet(null);
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    }
  }

  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <p className="text-red-600">{(q.error as Error)?.message ?? "Not found"}</p>;
  const { b, log } = q.data;
  const payments: PaymentRow[] = [...b.payments].sort((x: Payment, y: Payment) => x.created_at.localeCompare(y.created_at));
  const paid = payments.filter((p) => p.status === "verified").reduce((s, p) => s + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0);
  const balance = Math.max(0, Number(b.estimate) - paid);
  const live = ["confirmed", "checked_in"].includes(b.status);
  const blocked = b.status === "blocked";
  const status = (action: string, ok: string, reason = "") => act("set_booking_status", { p_booking: id, p_action: action, p_reason: reason }, ok);

  return (
    <div className="space-y-4">
      <Link to="/admin/bookings" search={{ tab: "today" }} className="inline-flex items-center gap-1 text-sm text-neutral-500"><Icon icon={ArrowLeft01Icon} size={16} /> Bookings</Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400">{b.code} · {SOURCE_LABEL[b.source]}</p>
          <h1 className="text-2xl font-semibold">{blocked ? `Blocked: ${b.block_reason}` : b.guests?.name}</h1>
          {b.guests?.mobile && (
            <a href={`tel:${b.guests.mobile}`} className="mt-1 inline-flex items-center gap-1 text-sm text-neutral-600"><Icon icon={Call02Icon} size={16} /> {b.guests.mobile}</a>
          )}
        </div>
        <Badge tone={b.checked_out_at && b.status !== "settled" ? "amber" : statusTone(b.status)}>
          {b.checked_out_at && b.status !== "settled" ? "Checked out · to settle" : STATUS_LABEL[b.status]}
        </Badge>
      </div>

      <Card className="space-y-1.5 text-sm">
        <Line k="Cottage" v={`${b.cottages.name} (${b.cottages.cottage_types.name})`} />
        <Line k="Date" v={niceDate(b.stay_date, { weekday: "long", month: "long", day: "numeric" })} />
        <Line k="Stay" v={`${SLOT_LABEL[b.slot as Slot]} · ${slotTimes(settings, b.slot)}`} />
        {!blocked && (
          <>
            <Line k="Guests" v={`${b.pax_adults} adults${b.pax_children ? `, ${b.pax_children} kids` : ""}`} />
            <div className="border-t border-neutral-100 pt-1.5" />
            <Line k="Estimate" v={money(b.estimate)} />
            <Line k="Paid" v={money(paid)} strong />
            {b.status === "settled" ? (
              <Line k={paid < b.estimate ? "Discount given" : "Above estimate"} v={money(Math.abs(Number(b.estimate) - paid))} />
            ) : (
              <Line k="Balance per estimate" v={money(balance)} />
            )}
          </>
        )}
        {b.notes && <p className="pt-1 text-neutral-600">“{b.notes}”</p>}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {blocked && <Button tone="outline" className="col-span-2" onClick={() => status("unblock", "Slot reopened")}>Unblock</Button>}
        {b.status === "confirmed" && <Button tone="success" onClick={() => status("check_in", "Checked in")}>Check in</Button>}
        {live && b.slot === "day" && <Button tone="outline" onClick={() => act("extend_to_overnight", { p_booking: id }, "Extended to overnight")}>Stay overnight</Button>}
        {live && <Button onClick={() => setSheet("settle")}>Settle</Button>}
        {b.status === "checked_in" && !b.checked_out_at && <Button tone="outline" onClick={() => status("check_out", "Checked out")}>Check out</Button>}
        {(live || b.status === "pending") && <Button tone="outline" onClick={() => setSheet("move")}>Move</Button>}
        {!blocked && b.status !== "cancelled" && <Button tone="outline" onClick={() => setSheet("edit")}>Edit details</Button>}
        {b.status === "confirmed" && <Button tone="danger" onClick={() => status("no_show", "Marked no-show")}>No-show</Button>}
        {(live || b.status === "pending") && <Button tone="danger" onClick={() => setSheet("cancel")}>Cancel</Button>}
      </div>

      {!blocked && (
        <section>
          <h2 className="mb-2 font-semibold">Payments</h2>
          {payments.length === 0 ? <p className="text-sm text-neutral-400">No payments yet.</p> : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="rounded-2xl border border-neutral-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium tabular-nums">{money(p.amount)} <span className="text-sm font-normal text-neutral-500">{p.kind === "final" ? "Final" : p.kind === "refund" ? "Refund" : "Downpayment"} · {METHOD_LABEL[p.method]}</span></p>
                      <p className="text-xs text-neutral-400">{niceDateTime(p.created_at)} · {p.created_by}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.edited && <Badge tone="amber">Edited</Badge>}
                      <Badge tone={p.status === "verified" ? "green" : p.status === "submitted" ? "amber" : "red"}>{p.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {p.receipt_path && <Button size="sm" tone="soft" onClick={async () => { const u = await signedUrl(p.receipt_path); if (u) window.open(u, "_blank"); }}>Photo</Button>}
                    {p.status === "submitted" && (
                      <>
                        <Button size="sm" tone="danger" onClick={() => act("verify_payment", { p_payment: p.id, p_ok: false }, "Rejected")}>Reject</Button>
                        <Button size="sm" tone="success" onClick={() => act("verify_payment", { p_payment: p.id, p_ok: true }, "Verified, booking confirmed")}>Verify</Button>
                      </>
                    )}
                    {p.status === "verified" && <Button size="sm" tone="soft" onClick={() => setSheet({ pay: p })}>Edit amount</Button>}
                  </div>
                  {p.payment_edits?.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-neutral-500">
                      {p.payment_edits.map((e) => <li key={e.id}>{niceDateTime(e.edited_at)} · {e.edited_by}: {money(e.old_amount)} → {money(e.new_amount)}{e.reason ? ` (${e.reason})` : ""}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">History</h2>
        <ul className="space-y-1 text-sm text-neutral-500">
          {log.map((l: any) => <li key={l.id}>{niceDateTime(l.at)} · <span className="text-neutral-800">{l.action}</span> · {l.actor || "system"}{l.detail ? ` · ${l.detail}` : ""}</li>)}
          {log.length === 0 && <li>Created {niceDateTime(b.created_at)} by {b.created_by}</li>}
        </ul>
      </section>

      {sheet === "settle" && <SettleSheet id={id} balance={balance} onClose={() => setSheet(null)} act={act} />}
      {sheet === "edit" && <EditSheet b={b} onClose={() => setSheet(null)} act={act} />}
      {sheet === "move" && <MoveSheet b={b} onClose={() => setSheet(null)} act={act} />}
      {sheet === "cancel" && <CancelSheet id={id} onClose={() => setSheet(null)} act={act} />}
      {sheet && typeof sheet === "object" && <EditPaymentSheet p={sheet.pay} onClose={() => setSheet(null)} act={act} />}
    </div>
  );
}

type Act = (fn: string, args: Record<string, unknown>, ok: string) => Promise<void>;

const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex justify-between gap-4"><span className="text-neutral-500">{k}</span><span className={strong ? "font-semibold tabular-nums" : "text-right"}>{v}</span></div>
);

function SettleSheet({ id, balance, onClose, act }: { id: string; balance: number; onClose: () => void; act: Act }) {
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("cash");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Settle">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const path = file ? await uploadReceipt(`staff/${id}`, file) : null;
            await act("settle_booking", { p_booking: id, p_amount: amount, p_method: method, p_receipt: path }, "Settled");
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Amount collected now" hint={`Balance per estimate is ${money(balance)}. Enter what was actually agreed; the difference is recorded as a discount.`}>
          <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} autoFocus />
        </Field>
        <Field label="Paid by">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank">Bank</option>
          </Select>
        </Field>
        <Field label="Photo of receipt or cash (optional)">
          <Input type="file" accept="image/*" capture="environment" className="h-auto py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Button type="submit" tone="success" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : `Settle · ${money(amount)}`}</Button>
      </form>
    </Sheet>
  );
}

function EditPaymentSheet({ p, onClose, act }: { p: PaymentRow; onClose: () => void; act: Act }) {
  const [amount, setAmount] = useState(Number(p.amount));
  const [reason, setReason] = useState("");
  return (
    <Sheet open onClose={onClose} title="Edit amount">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act("edit_payment", { p_payment: p.id, p_amount: amount, p_reason: reason }, "Amount updated"); }}>
        <p className="text-sm text-neutral-500">Was {money(p.amount)}. The old figure stays in the history and the owner sees the change.</p>
        <Field label="New amount"><Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} autoFocus /></Field>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. extra discount agreed" /></Field>
        <Button type="submit" size="lg" className="w-full">Save</Button>
      </form>
    </Sheet>
  );
}

function EditSheet({ b, onClose, act }: { b: any; onClose: () => void; act: Act }) {
  const [adults, setAdults] = useState<number>(b.pax_adults);
  const [kids, setKids] = useState<number>(b.pax_children);
  const [source, setSource] = useState<string>(b.source);
  const [notes, setNotes] = useState<string>(b.notes ?? "");
  const [estimate, setEstimate] = useState<number>(Number(b.estimate));
  async function reprice() {
    const n = await rpc<number>("price_estimate", { p_type: b.cottages.type_id, p_date: b.stay_date, p_slot: b.slot, p_adults: adults, p_children: kids });
    setEstimate(Number(n));
  }
  return (
    <Sheet open onClose={onClose} title="Edit details">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act("update_booking", { p_booking: b.id, p_adults: adults, p_children: kids, p_source: source, p_notes: notes, p_estimate: estimate }, "Saved"); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults"><Input type="number" min={0} value={adults} onChange={(e) => setAdults(Number(e.target.value))} onBlur={reprice} /></Field>
          <Field label="Kids"><Input type="number" min={0} value={kids} onChange={(e) => setKids(Number(e.target.value))} onBlur={reprice} /></Field>
        </div>
        <Field label="Source">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            {["website", "walk_in", "messenger", "whatsapp", "viber", "phone", "facebook"].map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Estimate" hint="Recalculated when you change the pax; you can still type over it.">
          <Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} />
        </Field>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full">Save</Button>
      </form>
    </Sheet>
  );
}

function MoveSheet({ b, onClose, act }: { b: any; onClose: () => void; act: Act }) {
  const cottages = useCottages().data ?? [];
  const types = useCottageTypes().data ?? [];
  const [cottage, setCottage] = useState<string>(b.cottage_id);
  const [date, setDate] = useState<string>(b.stay_date);
  const [slot, setSlot] = useState<string>(b.slot);
  return (
    <Sheet open onClose={onClose} title="Move booking">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act("move_booking", { p_booking: b.id, p_cottage: cottage, p_date: date, p_slot: slot }, "Moved"); }}>
        <Field label="Cottage">
          <Select value={cottage} onChange={(e) => setCottage(e.target.value)}>
            {types.map((t) => (
              <optgroup key={t.id} label={t.name}>
                {cottages.filter((c) => c.type_id === t.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Slot">
            <Select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {(Object.keys(SLOT_LABEL) as Slot[]).map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-neutral-500">Refused if the new cottage is taken for that time. The estimate is not changed; edit it after moving if needed.</p>
        <Button type="submit" size="lg" className="w-full">Move</Button>
      </form>
    </Sheet>
  );
}

function CancelSheet({ id, onClose, act }: { id: string; onClose: () => void; act: Act }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet open onClose={onClose} title="Cancel booking">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act("set_booking_status", { p_booking: id, p_action: "cancel", p_reason: reason }, "Cancelled"); }}>
        <Field label="Reason"><Input required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-sm text-neutral-500">The slot reopens. A downpayment already paid stays recorded as forfeited unless you edit it.</p>
        <Button type="submit" tone="danger" size="lg" className="w-full">Cancel booking</Button>
      </form>
    </Sheet>
  );
}
