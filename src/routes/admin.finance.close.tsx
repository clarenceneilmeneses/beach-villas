import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OwnerOnly } from "@/components/obs/app-shell";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { signed, usePayments } from "@/lib/finance";
import { manilaToday, METHOD_LABEL, niceDate, php } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/finance/close")({ component: () => <OwnerOnly><DailyClose /></OwnerOnly> });

const METHODS = ["cash", "gcash", "bank"] as const;

function DailyClose() {
  const today = manilaToday();
  const qc = useQueryClient();
  const q = usePayments(today, today);
  const closed = useQuery({ queryKey: ["close", today], queryFn: async () => (await supabase.from("daily_closes").select("*").eq("close_date", today).maybeSingle()).data });
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <LoadingState />;

  const rows = q.data ?? [];
  const people = [...new Set(rows.map((p) => p.created_by ?? "—"))];
  const sum = (m: string, who?: string) => rows.filter((p) => p.method === m && (!who || p.created_by === who)).reduce((s, p) => s + signed(p), 0);
  const cash = sum("cash");
  const diff = counted === "" ? 0 : Number(counted) - cash;

  async function close() {
    const { error } = await supabase.from("daily_closes").upsert({
      close_date: today,
      cash_counted: Number(counted),
      cash_expected: cash,
      note,
      closed_by: (await supabase.auth.getUser()).data.user?.email,
    });
    if (error) return void toast.error(error.message);
    toast.success("Day closed");
    qc.invalidateQueries({ queryKey: ["close"] });
  }

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={niceDate(today, { weekday: "long", month: "long", day: "numeric" })} title="Daily close" />
      <div className="grid gap-4 sm:grid-cols-3">
        {METHODS.map((m) => <KpiCard key={m} label={METHOD_LABEL[m]!} value={php(sum(m))} sub={m === "cash" ? "Should be in the drawer" : "Check against the app"} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collected by</TableHead>
                  {METHODS.map((m) => <TableHead key={m} className="text-right">{METHOD_LABEL[m]}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((who) => (
                  <TableRow key={who}>
                    <TableCell className="max-w-[200px] truncate text-sm">{who}</TableCell>
                    {METHODS.map((m) => <TableCell key={m} className="text-right tabular-nums">{php(sum(m, who))}</TableCell>)}
                  </TableRow>
                ))}
                {people.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No payments today yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="space-y-4 p-5">
            <p className="malaya-eyebrow">Cash count</p>
            {closed.data ? (
              <>
                <p className="font-display text-2xl">{php(closed.data.cash_counted)}</p>
                <p className="text-sm text-muted-foreground">
                  Closed by {closed.data.closed_by}.{" "}
                  {Number(closed.data.cash_counted) === Number(closed.data.cash_expected) ? "It matched." : (
                    <span className="text-destructive">{Number(closed.data.cash_counted) < Number(closed.data.cash_expected) ? "Short" : "Over"} by {php(Math.abs(Number(closed.data.cash_expected) - Number(closed.data.cash_counted)))}.</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="space-y-1.5"><Label htmlFor="dc-c">Cash counted</Label><Input id="dc-c" type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
                {counted !== "" && diff !== 0 && <p className="text-sm text-destructive">{diff < 0 ? "Short" : "Over"} by {php(Math.abs(diff))}</p>}
                <div className="space-y-1.5"><Label htmlFor="dc-n">Note</Label><Input id="dc-n" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <Button className="w-full" disabled={counted === ""} onClick={close}>Close the day</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
