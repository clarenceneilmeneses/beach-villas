import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "@/components/icons";
import { StatusPill } from "@/components/obs/booking-bits";
import { PhotoTile, PublicShell } from "@/components/public/chrome";
import { AuthPanel } from "@/components/public/auth-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PayDetails, ReceiptPicker, submitReceipt } from "@/components/public/pay-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { slotTimes, useSettings, type Booking, type Payment } from "@/lib/data";
import { niceDate, niceTime, php, SLOT_LABEL } from "@/lib/format";
import { rpc, supabase, uploadReceipt } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

  return (
    <PublicShell>
      <div className="mx-auto max-w-[1100px] px-4 pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="site-display text-3xl sm:text-4xl">My bookings</h1>
            {session && <p className="text-sm text-muted-foreground">{session.user.email}</p>}
          </div>
          {session && <Button variant="outline" className="rounded-full" onClick={() => supabase.auth.signOut()}>Sign out</Button>}
        </div>

        <div className="mt-6">
          {!ready ? <Skeleton className="h-40 rounded-3xl" /> : !session ? (
            <Card className="mx-auto max-w-sm rounded-3xl border-border/70 shadow-level-2"><CardContent className="p-6"><AuthPanel hint="Sign in to see your bookings." /></CardContent></Card>
          ) : list.isLoading ? <Skeleton className="h-40 rounded-3xl" /> : list.data?.length ? (
            <div className="grid gap-5 lg:grid-cols-2">{list.data.map((b) => <TripCard key={b.id} b={b} highlight={b.id === fresh} />)}</div>
          ) : (
            <Card className="rounded-3xl border-dashed shadow-none">
              <CardContent className="space-y-3 p-10 text-center">
                <p className="site-display text-xl">No bookings yet</p>
                <p className="text-sm text-muted-foreground">Pick a date and a cottage to book.</p>
                <Button asChild className="rounded-full"><Link to="/">Find a cottage</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PublicShell>
  );
}

function TripCard({ b, highlight }: { b: Row; highlight: boolean }) {
  const settings = useSettings().data;
  const dp = b.payments.find((p) => p.kind === "downpayment" && p.status !== "rejected");
  const needsReceipt = b.status === "pending" && !dp;
  const rejected = b.payments.some((p) => p.status === "rejected") && needsReceipt;
  return (
    <Card className={cn("rounded-3xl border-border/70 shadow-level-2", highlight && "ring-2 ring-primary")}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex gap-4">
          <PhotoTile name={b.cottages.cottage_types.name} className="size-20 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="malaya-eyebrow">{b.code}</p>
              <StatusPill status={b.status} verifying={dp?.status === "submitted"} />
            </div>
            <p className="site-display text-lg">{b.cottages.cottage_types.name} · {b.cottages.name}</p>
            <p className="text-sm text-muted-foreground">{niceDate(b.stay_date, { weekday: "short", month: "long", day: "numeric" })} · {SLOT_LABEL[b.slot]}</p>
            <p className="text-xs text-muted-foreground">{slotTimes(settings, b.slot)} · {b.pax_adults + b.pax_children} guests · estimate {php(b.estimate)}</p>
          </div>
        </div>
        {dp?.status === "submitted" && <p className="rounded-2xl border border-warning/30 bg-warning/[0.08] p-3 text-sm">We got your receipt. <span className="font-medium">It isn't confirmed until the front desk verifies the payment</span> — we'll message you when it is.</p>}
        {needsReceipt && (
          <div className="space-y-3 rounded-2xl border border-warning/30 bg-warning/[0.06] p-4 text-sm">
            <p className="font-medium">Send {php(b.cottages.cottage_types.downpayment)} to keep this booking{b.hold_until ? ` — held until ${niceTime(b.hold_until)}` : ""}.</p>
            {rejected && <p className="text-destructive">Your last receipt couldn't be verified. Please send it again or message us.</p>}
            <ReceiptForm booking={b} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReceiptForm({ booking }: { booking: Row }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = Number(booking.cottages.cottage_types.downpayment);
  async function send() {
    if (!file) return void toast.error("Attach the receipt screenshot");
    setBusy(true);
    try {
      const path = await uploadReceipt(session!.user.id, file);
      await submitReceipt(booking.id, path, amount);
      toast.success("Receipt sent");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <PayDetails amount={amount} />
      <ReceiptPicker file={file} onChange={setFile} />
      <Button className="w-full rounded-full" disabled={busy || !file} onClick={send}><Upload className="size-4" /> {busy ? "Sending…" : "Send receipt"}</Button>
    </div>
  );
}
