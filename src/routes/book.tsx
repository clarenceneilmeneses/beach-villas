import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AuthPanel } from "@/components/auth-panel";
import { GuestShell } from "@/components/guest-shell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { slotTimes, useCottageTypes, useSettings } from "@/lib/data";
import { money, niceDate, SLOT_LABEL, type Slot } from "@/lib/format";
import { rpc } from "@/lib/supabase";

type Search = { type: string; date: string; slot: Exclude<Slot, "day_night">; adults: number; children: number };

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: String(s.type ?? ""),
    date: String(s.date ?? ""),
    slot: (["day", "night", "h22"].includes(String(s.slot)) ? s.slot : "day") as Search["slot"],
    adults: Number(s.adults ?? 2),
    children: Number(s.children ?? 0),
  }),
  component: Book,
});

function Book() {
  const q = Route.useSearch();
  const { session, ready } = useAuth();
  const settings = useSettings().data;
  const type = useCottageTypes().data?.find((t) => t.id === q.type);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);

  const est = useQuery({
    queryKey: ["estimate", q.type, q.date, q.slot, q.adults, q.children],
    queryFn: () => rpc<number>("price_estimate", { p_type: q.type, p_date: q.date, p_slot: q.slot, p_adults: q.adults, p_children: q.children }),
    enabled: !!q.type,
  });

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await rpc<{ id: string; code: string; cottage: string }>("create_online_booking", {
        p_type: q.type, p_date: q.date, p_slot: q.slot, p_adults: q.adults, p_children: q.children, p_name: name, p_mobile: mobile,
      });
      toast.success(`Reserved ${r.cottage}. Send your downpayment to keep it.`);
      navigate({ to: "/my", search: { new: r.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!type) return <GuestShell><Spinner /></GuestShell>;

  return (
    <GuestShell>
      <Link to="/" className="text-sm text-neutral-500">← Change</Link>
      <h1 className="mt-2 text-2xl font-semibold">{type.name}</h1>
      <Card className="mt-4 space-y-2 text-sm">
        <Row k="Date" v={niceDate(q.date, { weekday: "long", month: "long", day: "numeric" })} />
        <Row k="Stay" v={`${SLOT_LABEL[q.slot]} · ${slotTimes(settings, q.slot)}`} />
        <Row k="Guests" v={`${q.adults} adults${q.children ? `, ${q.children} kids` : ""}`} />
        <div className="border-t border-neutral-100 pt-2" />
        <Row k="Estimated total" v={est.data !== undefined ? money(est.data) : "…"} strong />
        <Row k="Downpayment now" v={money(type.downpayment)} strong />
        <p className="pt-1 text-xs text-neutral-500">The final amount is settled at the resort. We hold your cottage for {settings?.hold_hours ?? 3} hours while you send the downpayment.</p>
      </Card>

      <Card className="mt-4">
        {!ready ? (
          <Spinner />
        ) : !session ? (
          <AuthPanel hint="Sign in or create an account to reserve. Your dates are kept." />
        ) : (
          <form onSubmit={reserve} className="space-y-3">
            <Field label="Your name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Mobile number"><Input required inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09xx xxx xxxx" /></Field>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Reserving…" : `Reserve · pay ${money(type.downpayment)} downpayment`}</Button>
          </form>
        )}
      </Card>
    </GuestShell>
  );
}

const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex justify-between gap-4">
    <span className="text-neutral-500">{k}</span>
    <span className={strong ? "font-semibold tabular-nums" : "text-right"}>{v}</span>
  </div>
);
