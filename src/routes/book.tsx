import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Minus, Pencil, Plus, ShieldCheck } from "@/components/icons";
import { useNavPillAway } from "@/components/nav-pill";
import { PhotoTile, PublicShell } from "@/components/public/chrome";
import { AuthPanel } from "@/components/public/auth-panel";
import { MethodPicker, PayDetails, ReceiptPicker, type Method } from "@/components/public/pay-panel";
import { stayParams, withDefaults } from "@/components/public/search-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { slotTimes, useCottageTypes, useSettings, type CottageType } from "@/lib/data";
import { manilaToday, niceDate, php, SLOT_LABEL } from "@/lib/format";
import { rpc, uploadReceipt } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>) => {
    const step = Number(s.step);
    return { ...stayParams(s), type: String(s.type ?? ""), ...(step >= 1 && step <= 4 ? { step: step as Step } : {}) };
  },
  component: Book,
});

/**
 * Malaya's checkout, one screen per subject: the trip, who's booking, paying
 * the downpayment (scan the QR, upload the receipt), then a last look and
 * Reserve. The step is in the URL so the phone's back button walks back.
 */
const QUESTIONS: { n: Step; title: string; lead: string }[] = [
  { n: 1, title: "Here's your trip", lead: "Check the date, the stay and the headcount before we go on." },
  { n: 2, title: "Who's booking?", lead: "The name on your ID, and a number we can reach." },
  { n: 3, title: "Pay the downpayment", lead: "Scan the QR, pay, then upload the receipt. It confirms your cottage." },
  { n: 4, title: "Everything look right?", lead: "Reserve sends your booking and receipt to the resort." },
];

function Book() {
  const search = Route.useSearch();
  const q = { ...withDefaults(search), type: search.type };
  const { session, ready } = useAuth();
  const settings = useSettings().data;
  const t = useCottageTypes().data?.find((x) => x.id === q.type);
  const navigate = useNavigate();
  const qc = useQueryClient();
  useNavPillAway(true);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [method, setMethod] = useState<Method>("gcash");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; code: string; cottage: string } | null>(null);

  const est = useQuery({
    queryKey: ["estimate", q.type, q.date, q.slot, q.adults, q.children],
    enabled: !!q.type,
    queryFn: () => rpc<number>("price_estimate", { p_type: q.type, p_date: q.date, p_slot: q.slot, p_adults: q.adults, p_children: q.children }),
  });

  const complete: Record<Step, boolean> = { 1: true, 2: name.trim().length > 1 && mobile.trim().length >= 7, 3: !!file, 4: true };
  const firstIncomplete = (([1, 2, 3, 4] as Step[]).find((n) => !complete[n]) ?? 4) as Step;
  const step = Math.min(search.step ?? 1, firstIncomplete) as Step;
  const goTo = (n: Step) => navigate({ to: "/book", search: { ...search, step: n } });

  async function reserve() {
    if (!t || !file) return;
    setBusy(true);
    try {
      const r = await rpc<{ id: string; code: string; cottage: string }>("create_online_booking", {
        p_type: q.type, p_date: q.date, p_slot: q.slot, p_adults: q.adults, p_children: q.children, p_name: name, p_mobile: mobile,
      });
      try {
        const path = await uploadReceipt(session!.user.id, file);
        await rpc("submit_receipt", { p_booking: r.id, p_path: path, p_method: method, p_amount: t.downpayment, p_reference: "" });
      } catch (e) {
        // The cottage is held; the receipt can be sent again from My bookings.
        toast.error(`Booked, but the receipt didn't upload: ${(e as Error).message}. Send it from My bookings.`);
      }
      qc.invalidateQueries();
      setDone(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Confirmed done={done} t={t} date={q.date} slot={q.slot} />;

  const question = QUESTIONS[step - 1]!;
  const next = () => (step < 4 ? goTo((step + 1) as Step) : void reserve());
  return (
    <PublicShell hideFooter>
      <div className="mx-auto max-w-[1100px] px-4 pb-40 pt-6 sm:px-8 lg:pb-12">
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => (step > 1 ? goTo((step - 1) as Step) : navigate({ to: "/cottages/$typeId", params: { typeId: q.type }, search: { date: q.date, slot: q.slot, adults: q.adults, children: q.children } }))}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section>
            {session && (
              <div className="mb-5 flex gap-1.5">
                {QUESTIONS.map((x) => <span key={x.n} className={cn("h-1 flex-1 rounded-full", x.n <= step ? "bg-primary" : "bg-border")} />)}
              </div>
            )}
            {!ready ? <Skeleton className="h-60 rounded-3xl" /> : !session ? (
              <Card className="rounded-3xl border-border/70 shadow-level-1">
                <CardContent className="space-y-5 p-6 sm:p-8">
                  <div>
                    <h1 className="site-display text-3xl">Sign in to book</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Your date, stay and guests are kept.</p>
                  </div>
                  <AuthPanel />
                </CardContent>
              </Card>
            ) : (
              <div key={step} className="animate-in fade-in-0 slide-in-from-right-4 duration-300">
                <p className="malaya-eyebrow">Step {step} of 4</p>
                <h1 className="site-display mt-1 text-3xl sm:text-4xl">{question.title}</h1>
                <p className="mt-2 text-muted-foreground">{question.lead}</p>
                <div className="mt-6">
                  {step === 1 && <Trip t={t} q={q} total={est.data} settings={settings} />}
                  {step === 2 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label htmlFor="bk-n">Full name</Label><Input id="bk-n" className="h-12" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
                      <div className="space-y-1.5"><Label htmlFor="bk-m">Mobile number</Label><Input id="bk-m" className="h-12" inputMode="tel" placeholder="09xx xxx xxxx" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
                      <p className="text-sm text-muted-foreground sm:col-span-2">Signed in as {session.user.email}. We'll message you here on the site.</p>
                    </div>
                  )}
                  {step === 3 && t && (
                    <div className="space-y-5">
                      <MethodPicker value={method} onChange={setMethod} />
                      <PayDetails method={method} amount={Number(t.downpayment)} />
                      <ReceiptPicker file={file} onChange={setFile} />
                    </div>
                  )}
                  {step === 4 && t && (
                    <div className="divide-y divide-border/60 rounded-3xl border border-border/70 bg-card px-5 shadow-level-1">
                      <Review k="Cottage" v={`${t.name} · ${SLOT_LABEL[q.slot]}`} onEdit={() => goTo(1)} />
                      <Review k="Date" v={`${niceDate(q.date, { weekday: "long", month: "long", day: "numeric" })} · ${slotTimes(settings, q.slot)}`} onEdit={() => goTo(1)} />
                      <Review k="Guests" v={`${q.adults} adults${q.children ? `, ${q.children} kids` : ""}`} onEdit={() => goTo(1)} />
                      <Review k="Booking for" v={`${name} · ${mobile}`} onEdit={() => goTo(2)} />
                      <Review k="Downpayment" v={`${php(t.downpayment)} by ${method === "gcash" ? "GCash" : "bank transfer"} · receipt attached`} onEdit={() => goTo(3)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="hidden lg:block">
            <Summary t={t} q={q} total={est.data} settings={settings}>
              {session && (
                <Button className="site-display mt-2 h-12 w-full rounded-full text-base" disabled={!complete[step] || busy} onClick={next}>
                  {busy ? "Reserving…" : step < 4 ? "Next" : "Reserve"}
                </Button>
              )}
            </Summary>
          </aside>
        </div>
      </div>

      {session && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-level-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{php(t?.downpayment)} <span className="text-sm font-normal text-muted-foreground">due now</span></p>
              <p className="text-xs text-muted-foreground">Estimated total {php(est.data)}</p>
            </div>
            <Button className="h-11 rounded-full px-7" disabled={!complete[step] || busy} onClick={next}>
              {busy ? "Reserving…" : step < 4 ? "Next" : "Reserve"}
            </Button>
          </div>
        </div>
      )}
    </PublicShell>
  );
}

type Q = { type: string; date: string; slot: "day" | "night" | "h22"; adults: number; children: number };
type S = ReturnType<typeof useSettings>["data"];

function Trip({ t, q, total, settings }: { t?: CottageType; q: Q; total?: number; settings: S }) {
  if (!t) return <Skeleton className="h-40 rounded-3xl" />;
  return (
    <div className="space-y-4">
      <div className="flex gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-level-1">
        <PhotoTile name={t.name} className="size-24 shrink-0 rounded-2xl" />
        <div>
          <p className="site-display text-lg">{t.name}</p>
          <p className="text-sm text-muted-foreground">{niceDate(q.date, { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className="text-sm text-muted-foreground">{SLOT_LABEL[q.slot]} · {slotTimes(settings, q.slot)}</p>
          <p className="text-sm text-muted-foreground">{q.adults} adults{q.children ? `, ${q.children} kids` : ""}</p>
        </div>
      </div>
      <PriceLines t={t} total={total} />
      <EditTrip t={t} q={q} />
    </div>
  );
}

/** Edit where you are (Malaya's checkout): the trip changes in a sheet, the guest stays on this step. */
function EditTrip({ t, q }: { t: CottageType; q: Q }) {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(q.date);
  const [slot, setSlot] = useState(q.slot);
  const [adults, setAdults] = useState(q.adults);
  const [kids, setKids] = useState(q.children);
  useEffect(() => {
    if (!open) return;
    setDate(q.date);
    setSlot(q.slot);
    setAdults(q.adults);
    setKids(q.children);
  }, [open, q.date, q.slot, q.adults, q.children]);
  const tooMany = adults + kids > t.max_pax;
  const save = () => {
    navigate({ to: "/book", search: { ...search, date, slot, adults, children: kids }, replace: true });
    setOpen(false);
  };
  const stepper = (label: string, value: number, min: number, set: (n: number) => void) => (
    <div className="flex items-center justify-between py-3">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-3">
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-full" disabled={value <= min} onClick={() => set(value - 1)} aria-label={"Fewer " + label}><Minus className="size-4" /></Button>
        <span className="w-6 text-center tabular-nums">{value}</span>
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-full" onClick={() => set(value + 1)} aria-label={"More " + label}><Plus className="size-4" /></Button>
      </span>
    </div>
  );
  return (
    <>
      <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}><Pencil className="size-4" /> Edit</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl pb-8">
          <SheetTitle className="font-display text-xl">Edit your trip</SheetTitle>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="et-date">Date</Label><Input id="et-date" type="date" className="h-12" min={manilaToday()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Stay</Label>
              <div className="inline-flex w-full gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1">
                {(["day", "night", "h22"] as const).map((x) => (
                  <button key={x} type="button" onClick={() => setSlot(x)} className={cn("flex-1 rounded-full py-1.5 text-[13px]", slot === x ? "bg-secondary font-medium text-primary" : "text-muted-foreground")}>{SLOT_LABEL[x]}</button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-border/60 rounded-2xl border border-border/70 px-4">
              {stepper("Adults", adults, 1, setAdults)}
              {stepper("Kids", kids, 0, setKids)}
            </div>
            {tooMany && <p className="text-sm text-destructive">{t.name} fits up to {t.max_pax} guests.</p>}
            <Button className="h-12 w-full rounded-full" disabled={tooMany || !date} onClick={save}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function PriceLines({ t, total }: { t: CottageType; total?: number }) {
  return (
    <div className="space-y-2 rounded-3xl bg-secondary/70 p-5 text-sm">
      <div className="flex justify-between"><span className="text-muted-foreground">Estimated total</span><span>{php(total)}</span></div>
      <div className="flex justify-between font-semibold"><span>Downpayment now</span><span>{php(t.downpayment)}</span></div>
      <p className="pt-1 text-xs text-muted-foreground">The rest is settled at the resort — the final amount is agreed there.</p>
    </div>
  );
}

function Summary({ t, q, total, settings, children }: { t?: CottageType; q: Q; total?: number; settings: S; children?: React.ReactNode }) {
  return (
    <Card className="sticky top-24 rounded-3xl border-border/70 shadow-level-3">
      <CardContent className="space-y-4 p-6">
        {!t ? <Skeleton className="h-40 rounded-2xl" /> : (
          <>
            <div className="flex gap-4">
              <PhotoTile name={t.name} className="size-20 shrink-0 rounded-2xl" />
              <div>
                <p className="site-display text-lg">{t.name}</p>
                <p className="text-sm text-muted-foreground">{SLOT_LABEL[q.slot]} · {niceDate(q.date)}</p>
                <p className="text-xs text-muted-foreground">{slotTimes(settings, q.slot)}</p>
              </div>
            </div>
            <PriceLines t={t} total={total} />
            {children}
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Held for {settings?.hold_hours ?? 3} hours while staff check your receipt.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const Review = ({ k, v, onEdit }: { k: string; v: string; onEdit: () => void }) => (
  <div className="flex items-start justify-between gap-4 py-4">
    <div className="min-w-0">
      <p className="malaya-eyebrow">{k}</p>
      <p className="mt-0.5">{v}</p>
    </div>
    <button type="button" onClick={onEdit} className="link-action shrink-0 text-sm">Edit</button>
  </div>
);

function Confirmed({ done, t, date, slot }: { done: { id: string; code: string; cottage: string }; t?: CottageType; date: string; slot: Q["slot"] }) {
  return (
    <PublicShell hideFooter>
      <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-8">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h1 className="site-display mt-4 text-3xl">You're booked in</h1>
        <p className="mt-2 text-muted-foreground">
          {done.cottage} · {niceDate(date, { weekday: "long", month: "long", day: "numeric" })} · {SLOT_LABEL[slot]}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Booking {done.code}. Staff will check your {php(t?.downpayment)} receipt and confirm it — watch your messages.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild className="rounded-full"><Link to="/my" search={{ new: done.id }}>My bookings</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link to="/messages">Message the resort</Link></Button>
        </div>
      </div>
    </PublicShell>
  );
}
