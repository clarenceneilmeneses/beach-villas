import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Clock, Minus, Plus, Sun, Users, Waves } from "@/components/icons";
import { useNavPillAway } from "@/components/nav-pill";
import { AvailabilityCalendar } from "@/components/public/availability-calendar";
import { PhotoTile, PublicShell } from "@/components/public/chrome";
import { stayParams, withDefaults, type GuestSlot } from "@/components/public/search-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { slotTimes, useCottageTypes, useSettings } from "@/lib/data";
import { manilaToday, php, SLOT_LABEL } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cottages/$typeId")({ validateSearch: stayParams, component: CottagePage });

const SLOTS: GuestSlot[] = ["day", "night", "h22"];

function CottagePage() {
  const { typeId } = Route.useParams();
  const initial = withDefaults(Route.useSearch());
  const navigate = useNavigate();
  const settings = useSettings().data;
  const types = useCottageTypes().data;
  const t = types?.find((x) => x.id === typeId);
  const idx = types?.findIndex((x) => x.id === typeId) ?? -1;
  const [date, setDate] = useState(initial.date);
  const [slot, setSlot] = useState<GuestSlot>(initial.slot);
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);

  const est = useQuery({
    queryKey: ["estimate", typeId, date, slot, adults, children],
    queryFn: () => rpc<number>("price_estimate", { p_type: typeId, p_date: date, p_slot: slot, p_adults: adults, p_children: children }),
  });
  const avail = useQuery({
    queryKey: ["availability", date],
    queryFn: () => rpc<{ type_id: string; slot: string; free: number }[]>("type_availability", { p_date: date }),
  });
  // The reserve bar takes the bottom edge on a phone, as on Malaya's villa page.
  useNavPillAway(true);
  const free = avail.data?.find((a) => a.type_id === typeId && a.slot === slot)?.free;

  if (!t)
    return (
      <PublicShell>
        <div className="mx-auto max-w-[1280px] space-y-4 px-4 py-8 sm:px-8"><Skeleton className="h-80 rounded-3xl" /><Skeleton className="h-40 rounded-3xl" /></div>
      </PublicShell>
    );

  const tooMany = adults + children > t.max_pax;
  const reserve = () => navigate({ to: "/book", search: { type: t.id, date, slot, adults, children } });
  const prev = types && idx > 0 ? types[idx - 1] : undefined;
  const next = types && idx < types.length - 1 ? types[idx + 1] : undefined;

  return (
    <PublicShell>
      <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-6 sm:px-8 md:pb-10">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Button variant="outline" asChild className="rounded-full"><Link to="/" search={{ date, slot, adults, children }}><ArrowLeft className="size-4" /> Back</Link></Button>
          <div className="hidden gap-2 sm:flex">
            {prev && <Button variant="outline" asChild className="rounded-full"><Link to="/cottages/$typeId" params={{ typeId: prev.id }} search={{ date, slot, adults, children }}>‹ {prev.name}</Link></Button>}
            {next && <Button variant="outline" asChild className="rounded-full"><Link to="/cottages/$typeId" params={{ typeId: next.id }} search={{ date, slot, adults, children }}>{next.name} ›</Link></Button>}
          </div>
        </div>

        <div className="grid gap-2.5 md:h-[300px] md:grid-cols-4 md:grid-rows-2">
          <PhotoTile name={t.name} className="aspect-[4/3] rounded-3xl md:col-span-2 md:row-span-2 md:aspect-auto" />
          {[0, 1, 2, 3].map((i) => <PhotoTile key={i} name={t.name} className="hidden rounded-3xl md:grid" />)}
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="rounded-3xl border-border/70 shadow-level-1">
              <CardContent className="p-6 sm:p-8">
                <h1 className="site-display text-3xl sm:text-4xl">{t.name}</h1>
                <p className="mt-2 text-muted-foreground">{t.description}</p>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Users className="size-4" /> {t.pax_included} included</span>·
                  <span>Up to {t.max_pax} guests</span>·
                  <span>+{php(t.extra_head_fee)} per extra head</span>
                </p>
                <div className="mt-6 grid gap-5 border-t border-border/70 pt-6 sm:grid-cols-3">
                  <Feature icon={Sun} title="Day tour" text={slotTimes(settings, "day")} />
                  <Feature icon={Clock} title="Overnight" text={slotTimes(settings, "night")} />
                  <Feature icon={Waves} title="22 hours" text={slotTimes(settings, "h22")} />
                </div>
              </CardContent>
            </Card>

            <Card id="availability" className="scroll-mt-24 rounded-3xl border-border/70 shadow-level-1">
              <CardContent className="space-y-4 p-6 sm:p-8">
                <h2 className="site-display text-2xl">Availability</h2>
                <AvailabilityCalendar typeId={t.id} slot={slot} onSlot={setSlot} date={date} onDate={setDate} />
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 shadow-level-1">
              <CardContent className="space-y-4 p-6 sm:p-8">
                <h2 className="site-display text-2xl">Rates</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {SLOTS.map((s) => (
                    <div key={s} className="rounded-2xl bg-secondary/70 p-4">
                      <p className="malaya-eyebrow">{SLOT_LABEL[s]}</p>
                      <p className="mt-1 font-display text-2xl">{php(s === "day" ? t.rate_day : s === "night" ? t.rate_night : t.rate_h22)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Fri–Sat add {php(t.weekend_surcharge)}. Entrance is {php(settings?.entrance_adult)} per adult and {php(settings?.entrance_child)} per child. The final amount is settled at the resort.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 shadow-level-1">
              <CardContent className="space-y-4 p-6 sm:p-8">
                <h2 className="site-display text-2xl">Good to know</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {[
                    `A ${php(t.downpayment)} downpayment confirms your booking`,
                    "Pay the downpayment by GCash or bank transfer",
                    "Extend a day tour to overnight at the front desk if free",
                    "Message us on Messenger, WhatsApp or Viber",
                  ].map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm"><Check className="mt-0.5 size-4 shrink-0" /> {x}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div id="reserve">
            <Card className="rounded-3xl border-border/70 shadow-level-3 lg:sticky lg:top-24">
              <CardContent className="space-y-4 p-6">
                <p><span className="font-display text-3xl">{php(est.data)}</span> <span className="text-muted-foreground">estimated</span></p>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <label className="block border-b border-border px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Date</span>
                    <input type="date" value={date} min={manilaToday()} onChange={(e) => setDate(e.target.value)} className="block w-full bg-transparent text-sm outline-none" />
                  </label>
                  <div className="border-b border-border px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Stay</span>
                    <div className="mt-1.5 flex gap-1">
                      {SLOTS.map((s) => (
                        <button key={s} type="button" onClick={() => setSlot(s)} className={cn("flex-1 rounded-full py-1.5 text-xs", slot === s ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70")}>{SLOT_LABEL[s]}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2">
                    <Counter label="Adults" value={adults} min={1} onChange={setAdults} />
                    <Counter label="Kids" value={children} min={0} onChange={setChildren} className="border-l border-border" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t.pax_included} guests included; {php(t.extra_head_fee)} per extra head, up to {t.max_pax}.</p>
                {tooMany && <p className="text-sm text-destructive">Up to {t.max_pax} guests for this cottage.</p>}
                <Button className="site-display h-12 w-full rounded-full text-base" disabled={tooMany || free === 0} onClick={reserve}>
                  {free === 0 ? "Full for this slot" : "Reserve"}
                </Button>
                <div className="space-y-1 border-t border-border/70 pt-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Downpayment now</span><span className="font-medium">{php(t.downpayment)}</span></div>
                  <p className="text-xs text-muted-foreground">{free !== undefined && free > 0 ? `${free} of this type free for that slot.` : ""} Held for {settings?.hold_hours ?? 3} hours while you pay.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-level-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{php(est.data)} <span className="text-sm font-normal text-muted-foreground">· {SLOT_LABEL[slot]}</span></p>
            <p className="text-xs text-muted-foreground">{adults + children} guests · {date}</p>
          </div>
          <Button className="h-11 rounded-full px-6" disabled={tooMany || free === 0} onClick={reserve}>{free === 0 ? "Full" : "Reserve"}</Button>
        </div>
      </div>
    </PublicShell>
  );
}

const Feature = ({ icon: Icon, title, text }: { icon: typeof Sun; title: string; text: string }) => (
  <div className="flex gap-3">
    <Icon className="mt-0.5 size-5 shrink-0" />
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  </div>
);

function Counter({ label, value, min, onChange, className }: { label: string; value: number; min: number; onChange: (n: number) => void; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-2.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)} className="grid size-6 place-items-center rounded-full border border-border disabled:opacity-40" aria-label={`Fewer ${label}`}><Minus className="size-3" /></button>
        <span className="w-4 text-center text-sm tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="grid size-6 place-items-center rounded-full border border-border" aria-label={`More ${label}`}><Plus className="size-3" /></button>
      </span>
    </div>
  );
}
