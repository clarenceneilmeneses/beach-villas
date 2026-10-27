import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "@/components/icons";
import { PhotoTile, PublicShell } from "@/components/public/chrome";
import { AuthPanel } from "@/components/public/auth-panel";
import { stayParams, withDefaults } from "@/components/public/search-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { slotTimes, useCottageTypes, useSettings } from "@/lib/data";
import { niceDate, php, SLOT_LABEL } from "@/lib/format";
import { rpc } from "@/lib/supabase";

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>) => ({ ...stayParams(s), type: String(s.type ?? "") }),
  component: Book,
});

/** Malaya's checkout: browsing is open, booking needs an account; the server re-prices. */
function Book() {
  const search = Route.useSearch();
  const q = { ...withDefaults(search), type: search.type };
  const { session, ready } = useAuth();
  const settings = useSettings().data;
  const t = useCottageTypes().data?.find((x) => x.id === q.type);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const est = useQuery({
    queryKey: ["estimate", q.type, q.date, q.slot, q.adults, q.children],
    enabled: !!q.type,
    queryFn: () => rpc<number>("price_estimate", { p_type: q.type, p_date: q.date, p_slot: q.slot, p_adults: q.adults, p_children: q.children }),
  });

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await rpc<{ id: string; code: string; cottage: string }>("create_online_booking", {
        p_type: q.type, p_date: q.date, p_slot: q.slot, p_adults: q.adults, p_children: q.children, p_name: name, p_mobile: mobile,
      });
      toast.success(`${r.cottage} is held for you — send the downpayment to keep it.`);
      navigate({ to: "/my", search: { new: r.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-8">
        <Button variant="outline" asChild className="rounded-full">
          <Link to="/cottages/$typeId" params={{ typeId: q.type }} search={{ date: q.date, slot: q.slot, adults: q.adults, children: q.children }}><ArrowLeft className="size-4" /> Back</Link>
        </Button>
        <h1 className="site-display mt-6 text-3xl sm:text-4xl">Confirm and pay</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="rounded-3xl border-border/70 shadow-level-1">
            <CardContent className="space-y-5 p-6 sm:p-8">
              {!ready ? <Skeleton className="h-48 rounded-2xl" /> : !session ? (
                <>
                  <div>
                    <h2 className="site-display text-xl">Sign in to book</h2>
                    <p className="text-sm text-muted-foreground">Your date, stay and guests are kept.</p>
                  </div>
                  <AuthPanel />
                </>
              ) : (
                <form onSubmit={reserve} className="space-y-5">
                  <div>
                    <h2 className="site-display text-xl">Your details</h2>
                    <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="bk-n">Full name</Label><Input id="bk-n" required value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="bk-m">Mobile number</Label><Input id="bk-m" required inputMode="tel" placeholder="09xx xxx xxxx" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
                  </div>
                  <div className="rounded-2xl bg-secondary/70 p-4 text-sm">
                    <p className="font-medium">How paying works</p>
                    <p className="mt-1 text-muted-foreground">Send the {php(t?.downpayment)} downpayment by GCash or bank transfer and upload the receipt. We hold the cottage for {settings?.hold_hours ?? 3} hours while you do. The rest is settled at the resort.</p>
                  </div>
                  <Button type="submit" className="site-display h-12 w-full rounded-full text-base" disabled={busy || !t}>{busy ? "Reserving…" : `Reserve · ${php(t?.downpayment)} downpayment`}</Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit rounded-3xl border-border/70 shadow-level-3 lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-6">
              {!t ? <Skeleton className="h-40 rounded-2xl" /> : (
                <>
                  <div className="flex gap-4">
                    <PhotoTile name={t.name} className="size-24 shrink-0 rounded-2xl" />
                    <div>
                      <p className="site-display text-lg">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{SLOT_LABEL[q.slot]}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border/70 pt-4 text-sm">
                    <Row k="Date" v={niceDate(q.date, { weekday: "short", month: "long", day: "numeric" })} />
                    <Row k="Time" v={slotTimes(settings, q.slot)} />
                    <Row k="Guests" v={`${q.adults} adults${q.children ? `, ${q.children} kids` : ""}`} />
                  </div>
                  <div className="space-y-2 border-t border-border/70 pt-4 text-sm">
                    <Row k="Estimated total" v={php(est.data)} />
                    <Row k="Downpayment now" v={php(t.downpayment)} strong />
                  </div>
                  <p className="flex items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Clear pricing. The final amount is agreed at the resort.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}

const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className={strong ? "font-semibold" : "text-right"}>{v}</span></div>
);
