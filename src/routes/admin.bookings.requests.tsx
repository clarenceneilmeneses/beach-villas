import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye } from "@/components/icons";
import { MethodPill, SourcePill } from "@/components/obs/booking-bits";
import { SectionHeading } from "@/components/obs/cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { niceDate, niceDateTime, php, SLOT_LABEL, type Slot } from "@/lib/format";
import { rpc, signedUrl, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings/requests")({ component: Requests });

/** Online bookings waiting on a person: a downpayment receipt to verify. */
function Requests() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, reference, receipt_path, created_at, booking_id, bookings(code, stay_date, slot, source, hold_until, pax_adults, pax_children, estimate, cottages(name), guests(name, mobile))")
        .eq("status", "submitted")
        .order("created_at");
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  async function decide(id: string, ok: boolean) {
    try {
      await rpc("verify_payment", { p_payment: id, p_ok: ok });
      toast.success(ok ? "Verified — the booking is confirmed" : "Rejected — the guest can send it again");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <LoadingState />;
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`${q.data?.length ?? 0} waiting`} title="Downpayments to verify" />
      {!q.data?.length ? (
        <EmptyState title="No receipts to verify" message="Online bookings land here when the guest uploads a downpayment receipt." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {q.data.map((p) => {
            const b = p.bookings;
            return (
              <Card key={p.id} className="border-border/70 bg-surface shadow-level-2">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="malaya-eyebrow">{b?.code}</p>
                      <Link to="/admin/bookings/$id" params={{ id: p.booking_id }} className="font-display text-lg hover:underline">{b?.guests?.name}</Link>
                      <p className="text-sm text-muted-foreground">{b?.cottages?.name} · {niceDate(b?.stay_date)} · {SLOT_LABEL[b?.slot as Slot]}</p>
                    </div>
                    <SourcePill source={b?.source} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/70 px-4 py-3">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Downpayment</p>
                      <p className="font-display text-xl tabular-nums">{php(p.amount)}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <MethodPill method={p.method} />
                      {p.reference && <p className="mt-1">{p.reference}</p>}
                      <p className="mt-1">{niceDateTime(p.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={async () => { const u = await signedUrl(p.receipt_path); u ? window.open(u, "_blank") : toast.error("No receipt file"); }}>
                      <Eye className="size-4" /> View receipt
                    </Button>
                    <div className="flex-1" />
                    <Button variant="destructive-outline" size="sm" onClick={() => decide(p.id, false)}>Reject</Button>
                    <Button variant="success" size="sm" onClick={() => decide(p.id, true)}>Verify</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
