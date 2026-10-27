import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BeachIcon, Location01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { GuestShell } from "@/components/guest-shell";
import { Badge, Card, Field, Icon, Input, SchemaNotice, Segmented, Spinner } from "@/components/ui";
import { isMissingSchema, slotTimes, useCottageTypes, useSettings, type CottageType } from "@/lib/data";
import { addDays, manilaToday, money, SLOT_LABEL, type Slot } from "@/lib/format";
import { rpc } from "@/lib/supabase";

export const Route = createFileRoute("/")({ component: Home });

type GuestSlot = Exclude<Slot, "day_night">;

function Home() {
  const settings = useSettings();
  const types = useCottageTypes();
  const [date, setDate] = useState(() => addDays(manilaToday(), 1));
  const [slot, setSlot] = useState<GuestSlot>("day");
  const [adults, setAdults] = useState(4);
  const [children, setChildren] = useState(0);

  const avail = useQuery({
    queryKey: ["availability", date],
    queryFn: () => rpc<{ type_id: string; slot: string; free: number }[]>("type_availability", { p_date: date }),
  });

  if (types.error) return <GuestShell><SchemaNotice error={types.error} /></GuestShell>;

  return (
    <GuestShell>
      <section className="rounded-3xl bg-neutral-50 px-5 py-8">
        <Icon icon={BeachIcon} size={28} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{settings.data?.resort_name ?? "Beach Villas"}</h1>
        <p className="mt-1 text-neutral-600">{settings.data?.tagline}</p>
        {settings.data?.address && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-neutral-500"><Icon icon={Location01Icon} size={16} /> {settings.data.address}</p>
        )}
      </section>

      <Card className="mt-4 space-y-4">
        <Field label="Date">
          <Input type="date" value={date} min={manilaToday()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Stay</span>
          <Segmented<GuestSlot>
            value={slot}
            onChange={setSlot}
            options={(["day", "night", "h22"] as const).map((s) => ({ value: s, label: SLOT_LABEL[s] }))}
          />
          <p className="mt-1.5 text-xs text-neutral-500">{slotTimes(settings.data, slot)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults"><Input type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} /></Field>
          <Field label="Kids"><Input type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))} /></Field>
        </div>
      </Card>

      <h2 className="mb-2 mt-6 text-lg font-semibold">Cottages</h2>
      {types.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {types.data?.map((t) => (
            <TypeCard key={t.id} t={t} date={date} slot={slot} adults={adults} children={children}
              free={avail.data?.find((a) => a.type_id === t.id && a.slot === slot)?.free} />
          ))}
        </div>
      )}
      {avail.error && !isMissingSchema(avail.error) && <p className="mt-2 text-sm text-red-600">{(avail.error as Error).message}</p>}

      <footer className="mt-10 border-t border-neutral-100 pt-6 text-sm text-neutral-500">
        <p>Entrance: {money(settings.data?.entrance_adult)} per adult · {money(settings.data?.entrance_child)} per child.</p>
        <p className="mt-1">Downpayment confirms your booking. The rest is settled at the resort.</p>
      </footer>
    </GuestShell>
  );
}

function TypeCard({ t, date, slot, adults, children, free }: { t: CottageType; date: string; slot: GuestSlot; adults: number; children: number; free: number | undefined }) {
  const est = useQuery({
    queryKey: ["estimate", t.id, date, slot, adults, children],
    queryFn: () => rpc<number>("price_estimate", { p_type: t.id, p_date: date, p_slot: slot, p_adults: adults, p_children: children }),
  });
  const tooMany = adults + children > t.max_pax;
  const soldOut = free === 0;
  const rate = slot === "day" ? t.rate_day : slot === "night" ? t.rate_night : t.rate_h22;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t.name}</h3>
          <p className="mt-0.5 text-sm text-neutral-600">{t.description}</p>
        </div>
        {free !== undefined && <Badge tone={soldOut ? "red" : free <= 1 ? "amber" : "green"}>{soldOut ? "Full" : `${free} free`}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
        <span className="flex items-center gap-1"><Icon icon={UserGroupIcon} size={16} /> {t.pax_included} included, up to {t.max_pax}</span>
        <span>{money(rate)} {SLOT_LABEL[slot].toLowerCase()}</span>
        {t.extra_head_fee > 0 && <span>+{money(t.extra_head_fee)} per extra head</span>}
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-neutral-500">Estimated total</p>
          <p className="text-xl font-semibold tabular-nums">{est.data !== undefined ? money(est.data) : "…"}</p>
          <p className="text-xs text-neutral-500">Downpayment {money(t.downpayment)}</p>
        </div>
        {tooMany ? (
          <span className="text-sm text-red-600">Too many guests</span>
        ) : (
          <Link
            to="/book"
            search={{ type: t.id, date, slot, adults, children }}
            disabled={soldOut}
            className={`rounded-full px-5 py-2.5 text-sm font-medium ${soldOut ? "bg-neutral-200 text-neutral-500" : "bg-neutral-900 text-white"}`}
          >
            Book
          </Link>
        )}
      </div>
    </Card>
  );
}
