import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera, Phone } from "@/components/icons";
import { MethodPill, PaymentPill, SourcePill, StatusPill } from "@/components/obs/booking-bits";
import { SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { slotTimes, useCottages, useCottageTypes, useSettings, type Payment } from "@/lib/data";
import { niceDate, niceDateTime, php, SLOT_LABEL, SOURCE_LABEL, type Slot } from "@/lib/format";
import { rpc, signedUrl, supabase, uploadReceipt } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings/$id")({ component: Detail });

type PaymentRow = Payment & { payment_edits: { id: string; old_amount: number; new_amount: number; reason: string; edited_by: string; edited_at: string }[] };
type Act = (fn: string, args: Record<string, unknown>, ok: string) => Promise<boolean>;
type Open = null | "settle" | "edit" | "move" | "cancel" | { pay: PaymentRow };

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const settings = useSettings().data;
  const [dialog, setDialog] = useState<Open>(null);
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const [b, log] = await Promise.all([
        supabase.from("bookings").select("*, cottages(name, type_id, cottage_types(name, downpayment)), guests(*), payments(*, payment_edits(*))").eq("id", id).single(),
        supabase.from("activity_log").select("*").eq("booking_id", id).order("at", { ascending: false }).limit(30),
      ]);
      if (b.error) throw new Error(b.error.message);
      return { b: b.data as any, log: (log.data ?? []) as any[] };
    },
  });

  const act: Act = async (fn, args, ok) => {
    try {
      await rpc(fn, args);
      toast.success(ok);
      qc.invalidateQueries();
      setDialog(null);
      return true;
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
      return false;
    }
  };

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <LoadingState />;
  const { b, log } = q.data;
  const payments: PaymentRow[] = [...b.payments].sort((x: Payment, y: Payment) => x.created_at.localeCompare(y.created_at));
  const paid = payments.filter((p) => p.status === "verified").reduce((s, p) => s + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0);
  const balance = Math.max(0, Number(b.estimate) - paid);
  const live = ["confirmed", "checked_in"].includes(b.status);
  const blocked = b.status === "blocked";
  const status = (action: string, ok: string, reason = "") => act("set_booking_status", { p_booking: id, p_action: action, p_reason: reason }, ok);

  return (
    <div className="space-y-6">
      <Link to="/admin/bookings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Reservations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="malaya-eyebrow">{b.code} · {SOURCE_LABEL[b.source]}</p>
          <h1 className="font-display text-2xl sm:text-3xl">{blocked ? `Blocked: ${b.block_reason}` : b.guests?.name}</h1>
          {b.guests?.mobile && (
            <a href={`tel:${b.guests.mobile}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Phone className="size-4" /> {b.guests.mobile}
            </a>
          )}
        </div>
        <StatusPill status={b.status} checkedOut={!!b.checked_out_at} className="text-xs" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-surface shadow-level-2">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <Fact k="Cottage" v={`${b.cottages.name}`} sub={b.cottages.cottage_types.name} />
              <Fact k="Date" v={niceDate(b.stay_date, { weekday: "long", month: "long", day: "numeric" })} />
              <Fact k="Stay" v={SLOT_LABEL[b.slot as Slot]} sub={slotTimes(settings, b.slot)} />
              {!blocked && <Fact k="Guests" v={`${b.pax_adults} adults${b.pax_children ? `, ${b.pax_children} kids` : ""}`} />}
              {b.notes && <div className="sm:col-span-2"><p className="malaya-eyebrow mb-1">Notes</p><p className="text-sm">{b.notes}</p></div>}
            </CardContent>
          </Card>

          {!blocked && (
            <section>
              <SectionHeading eyebrow={`${payments.length} recorded`} title="Payments" />
              <Card className="border-border/70 bg-surface shadow-level-2">
                <CardContent className="p-0">
                  {payments.length === 0 ? (
                    <p className="p-5 text-sm text-muted-foreground">No payments yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Kind</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id} className="align-top">
                            <TableCell className="whitespace-nowrap text-sm">
                              {niceDateTime(p.created_at)}
                              <p className="max-w-[160px] truncate text-xs text-muted-foreground">{p.created_by}</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {p.kind === "final" ? "Final" : p.kind === "refund" ? "Refund" : "Downpayment"}
                              <div className="mt-1"><MethodPill method={p.method} /></div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {php(p.amount)}
                              {p.payment_edits?.map((e) => (
                                <p key={e.id} className="text-[11px] text-muted-foreground">was {php(e.old_amount)} · {e.edited_by?.split("@")[0]}{e.reason ? ` · ${e.reason}` : ""}</p>
                              ))}
                            </TableCell>
                            <TableCell>
                              <PaymentPill status={p.status} />
                              {p.edited && <Badge variant="outline" className="ml-1 rounded-full border-warning/30 bg-warning/12 text-[11px] text-warning">Edited</Badge>}
                            </TableCell>
                            <TableCell className="space-x-1 whitespace-nowrap text-right">
                              {p.receipt_path && (
                                <Button size="sm" variant="ghost" onClick={async () => { const u = await signedUrl(p.receipt_path); if (u) window.open(u, "_blank"); }}>
                                  <Camera className="size-4" />
                                </Button>
                              )}
                              {p.status === "submitted" && (
                                <>
                                  <Button size="sm" variant="destructive-outline" onClick={() => act("verify_payment", { p_payment: p.id, p_ok: false }, "Rejected")}>Reject</Button>
                                  <Button size="sm" variant="success" onClick={() => act("verify_payment", { p_payment: p.id, p_ok: true }, "Verified — booking confirmed")}>Verify</Button>
                                </>
                              )}
                              {p.status === "verified" && <Button size="sm" variant="outline" onClick={() => setDialog({ pay: p })}>Edit</Button>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          <section>
            <SectionHeading title="History" />
            <Card className="border-border/70 bg-surface shadow-level-1">
              <CardContent className="p-5">
                <ul className="space-y-2 text-sm">
                  {log.map((l) => (
                    <li key={l.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                      <span className="tabular-nums">{niceDateTime(l.at)}</span>
                      <span className="font-medium text-foreground">{l.action}</span>
                      <span>{l.actor || "system"}</span>
                      {l.detail && <span>· {l.detail}</span>}
                    </li>
                  ))}
                  {log.length === 0 && <li className="text-muted-foreground">Created {niceDateTime(b.created_at)} by {b.created_by}</li>}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>

        <aside className="space-y-4">
          {!blocked && (
            <Card className="border-border/70 bg-surface shadow-level-2">
              <CardContent className="space-y-3 p-5">
                <p className="malaya-eyebrow">{b.status === "settled" ? "Final amount" : "Estimate"}</p>
                <p className="font-display text-[28px] leading-tight">{php(b.status === "settled" ? paid : b.estimate)}</p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/70 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Paid</p>
                    <p className="text-sm font-semibold tabular-nums">{php(paid)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-muted-foreground">{b.status === "settled" ? (paid < b.estimate ? "Discount" : "Above est.") : "Balance"}</p>
                    <p className="text-sm font-semibold tabular-nums">{php(b.status === "settled" ? Math.abs(Number(b.estimate) - paid) : balance)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">The final amount is flexible: whatever is agreed on site is logged at Settle.</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/70 bg-surface shadow-level-2">
            <CardContent className="grid gap-2 p-5">
              <p className="malaya-eyebrow mb-1">Actions</p>
              {blocked && <Button variant="outline" onClick={() => status("unblock", "Slot reopened")}>Unblock</Button>}
              {b.status === "confirmed" && <Button variant="success" onClick={() => status("check_in", "Checked in")}>Check in</Button>}
              {live && b.slot === "day" && <Button variant="outline" onClick={() => act("extend_to_overnight", { p_booking: id }, "Extended to overnight")}>Stay overnight</Button>}
              {live && <Button onClick={() => setDialog("settle")}>Settle</Button>}
              {b.status === "checked_in" && !b.checked_out_at && <Button variant="outline" onClick={() => status("check_out", "Checked out")}>Check out</Button>}
              {(live || b.status === "pending") && <Button variant="outline" onClick={() => setDialog("move")}>Move cottage or date</Button>}
              {!blocked && b.status !== "cancelled" && <Button variant="outline" onClick={() => setDialog("edit")}>Edit details</Button>}
              {b.status === "confirmed" && <Button variant="destructive-outline" onClick={() => status("no_show", "Marked no-show")}>No-show</Button>}
              {(live || b.status === "pending") && <Button variant="destructive-outline" onClick={() => setDialog("cancel")}>Cancel booking</Button>}
              {!live && !blocked && b.status !== "pending" && <p className="text-sm text-muted-foreground">Nothing left to do on this booking.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      {dialog === "settle" && <SettleDialog id={id} balance={balance} onClose={() => setDialog(null)} act={act} />}
      {dialog === "edit" && <EditDialog b={b} onClose={() => setDialog(null)} act={act} />}
      {dialog === "move" && <MoveDialog b={b} onClose={() => setDialog(null)} act={act} />}
      {dialog === "cancel" && <CancelDialog id={id} onClose={() => setDialog(null)} act={act} />}
      {dialog && typeof dialog === "object" && <EditPaymentDialog p={dialog.pay} onClose={() => setDialog(null)} act={act} />}
    </div>
  );
}

const Fact = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div>
    <p className="malaya-eyebrow mb-1">{k}</p>
    <p className="font-medium">{v}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

function Shell({ title, description, onClose, children, footer }: { title: string; description?: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MethodSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="gcash">GCash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
  </Select>
);

function SettleDialog({ id, balance, onClose, act }: { id: string; balance: number; onClose: () => void; act: Act }) {
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("cash");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const path = file ? await uploadReceipt(`staff/${id}`, file) : null;
      await act("settle_booking", { p_booking: id, p_amount: amount, p_method: method, p_receipt: path }, "Settled");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title="Settle"
      description={`Balance per estimate is ${php(balance)}. Enter what was actually agreed; the difference is recorded as a discount.`}
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="success" disabled={busy} onClick={save}>{busy ? "Saving…" : `Settle · ${php(amount)}`}</Button></>}
    >
      <div className="space-y-1.5"><Label htmlFor="st-amt">Amount collected now</Label><Input id="st-amt" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} autoFocus /></div>
      <div className="space-y-1.5"><Label>Paid by</Label><MethodSelect value={method} onChange={setMethod} /></div>
      <div className="space-y-1.5"><Label htmlFor="st-photo">Photo of the receipt or the cash (optional)</Label><Input id="st-photo" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
    </Shell>
  );
}

function EditPaymentDialog({ p, onClose, act }: { p: PaymentRow; onClose: () => void; act: Act }) {
  const [amount, setAmount] = useState(Number(p.amount));
  const [reason, setReason] = useState("");
  return (
    <Shell
      title="Edit amount"
      description={`Was ${php(p.amount)}. The old figure stays in the history and the owner sees the change.`}
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => act("edit_payment", { p_payment: p.id, p_amount: amount, p_reason: reason }, "Amount updated")}>Save</Button></>}
    >
      <div className="space-y-1.5"><Label htmlFor="ep-amt">New amount</Label><Input id="ep-amt" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} autoFocus /></div>
      <div className="space-y-1.5"><Label htmlFor="ep-r">Reason</Label><Input id="ep-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. extra discount agreed" /></div>
    </Shell>
  );
}

function EditDialog({ b, onClose, act }: { b: any; onClose: () => void; act: Act }) {
  const [adults, setAdults] = useState<number>(b.pax_adults);
  const [kids, setKids] = useState<number>(b.pax_children);
  const [source, setSource] = useState<string>(b.source);
  const [notes, setNotes] = useState<string>(b.notes ?? "");
  const [estimate, setEstimate] = useState<number>(Number(b.estimate));
  const reprice = async () => setEstimate(Number(await rpc<number>("price_estimate", { p_type: b.cottages.type_id, p_date: b.stay_date, p_slot: b.slot, p_adults: adults, p_children: kids })));
  return (
    <Shell
      title="Edit details"
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => act("update_booking", { p_booking: b.id, p_adults: adults, p_children: kids, p_source: source, p_notes: notes, p_estimate: estimate }, "Saved")}>Save</Button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="ed-a">Adults</Label><Input id="ed-a" type="number" min={0} value={adults} onChange={(e) => setAdults(Number(e.target.value))} onBlur={reprice} /></div>
        <div className="space-y-1.5"><Label htmlFor="ed-k">Kids</Label><Input id="ed-k" type="number" min={0} value={kids} onChange={(e) => setKids(Number(e.target.value))} onBlur={reprice} /></div>
      </div>
      <div className="space-y-1.5">
        <Label>Booking source</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["website", "walk_in", "messenger", "whatsapp", "viber", "phone", "facebook"].map((s) => <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="ed-e">Estimate</Label><Input id="ed-e" type="number" min={0} value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} /><p className="text-xs text-muted-foreground">Recalculated when the pax change; you can still type over it.</p></div>
      <div className="space-y-1.5"><Label htmlFor="ed-n">Notes</Label><Textarea id="ed-n" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    </Shell>
  );
}

function MoveDialog({ b, onClose, act }: { b: any; onClose: () => void; act: Act }) {
  const cottages = useCottages().data ?? [];
  const types = useCottageTypes().data ?? [];
  const [cottage, setCottage] = useState<string>(b.cottage_id);
  const [date, setDate] = useState<string>(b.stay_date);
  const [slot, setSlot] = useState<string>(b.slot);
  return (
    <Shell
      title="Move booking"
      description="Refused if the new cottage is taken for that time. The estimate stays; edit it after if needed."
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => act("move_booking", { p_booking: b.id, p_cottage: cottage, p_date: date, p_slot: slot }, "Moved")}>Move</Button></>}
    >
      <div className="space-y-1.5">
        <Label>Cottage</Label>
        <Select value={cottage} onValueChange={setCottage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectGroup key={t.id}>
                <SelectLabel>{t.name}</SelectLabel>
                {cottages.filter((c) => c.type_id === t.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="mv-d">Date</Label><Input id="mv-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Slot</Label>
          <Select value={slot} onValueChange={setSlot}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(SLOT_LABEL) as Slot[]).map((s) => <SelectItem key={s} value={s}>{SLOT_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </Shell>
  );
}

function CancelDialog({ id, onClose, act }: { id: string; onClose: () => void; act: Act }) {
  const [reason, setReason] = useState("");
  return (
    <Shell
      title="Cancel booking"
      description="The slot reopens. A downpayment already paid stays recorded as forfeited unless you edit it."
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Keep booking</Button><Button variant="destructive" disabled={!reason.trim()} onClick={() => act("set_booking_status", { p_booking: id, p_action: "cancel", p_reason: reason }, "Cancelled")}>Cancel booking</Button></>}
    >
      <div className="space-y-1.5"><Label htmlFor="cn-r">Reason</Label><Input id="cn-r" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></div>
    </Shell>
  );
}
