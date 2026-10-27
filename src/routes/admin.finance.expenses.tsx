import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Plus } from "@/components/icons";
import { OwnerOnly } from "@/components/obs/app-shell";
import { KpiCard, SectionHeading } from "@/components/obs/cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationBar, usePagination } from "@/components/obs/paginated";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCottages } from "@/lib/data";
import { downloadCsv } from "@/lib/finance";
import { scopedCottages, useFilters } from "@/lib/filters";
import { manilaToday, niceDate, php } from "@/lib/format";
import { allRows, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/finance/expenses")({ component: () => <OwnerOnly><Expenses /></OwnerOnly> });

const CATEGORIES = ["Utilities", "Staff", "Supplies", "Repairs", "Laundry", "Other"];

function Expenses() {
  const { filters, range: picked } = useFilters();
  const allCottages = useCottages().data ?? [];
  const [adding, setAdding] = useState(false);
  const { from, to } = picked;
  const q = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: async () => {
      return allRows<any>(() => supabase.from("expenses").select("*, cottages(name)").gte("spent_on", from).lte("spent_on", to).order("spent_on", { ascending: false }).order("id"));
    },
  });
  const scope = scopedCottages(filters.scope, allCottages);
  // A cottage filter shows that cottage's costs; resort-wide costs only under All cottages.
  const rows = (q.data ?? []).filter((x) => !scope || (x.cottage_id && scope.has(x.cottage_id)));
  const paged = usePagination(rows, { initialPageSize: 50, resetKey: `${from}|${to}|${filters.scope}` });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const total = rows.reduce((s, x) => s + Number(x.amount), 0);
  const byCat = CATEGORIES.map((c) => ({ c, v: rows.filter((x) => x.category === c).reduce((s, x) => s + Number(x.amount), 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={`Expenses · ${niceDate(from, { month: "short", day: "numeric" })} – ${niceDate(to, { month: "short", day: "numeric" })}`}
        title="Money out"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadCsv(`expenses-${from}-${to}.csv`, rows.map((x) => ({ date: x.spent_on, category: x.category, for: x.cottages?.name ?? "Resort", amount: x.amount, note: x.note, by: x.created_by })))}><Download className="size-4" /> CSV</Button>
            <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Record expense</Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Total spent" value={php(total)} sub={`${rows.length} entries`} />
        {byCat.slice(0, 3).map((x) => <KpiCard key={x.c} label={x.c} value={php(x.v)} sub={`${Math.round((x.v / (total || 1)) * 100)}% of spending`} />)}
      </div>
      {q.isLoading ? <LoadingState /> : rows.length === 0 ? <EmptyState title="No expenses in this period" action={<Button onClick={() => setAdding(true)}>Record expense</Button>} /> : (
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden sm:table-cell">For</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.page.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="whitespace-nowrap text-sm">{niceDate(x.spent_on)}</TableCell>
                    <TableCell className="text-sm">{x.category}</TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">{x.cottages?.name ?? "Whole resort"}</TableCell>
                    <TableCell className="hidden max-w-[260px] truncate text-sm text-muted-foreground md:table-cell">{x.note}</TableCell>
                    <TableCell className="text-right tabular-nums">{php(x.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {rows.length > 0 && <PaginationBar pagination={paged} noun="expenses" />}
      {adding && <AddExpense onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddExpense({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const cottages = useCottages().data ?? [];
  const [f, setF] = useState({ spent_on: manilaToday(), category: "Supplies", amount: "", cottage_id: "resort", note: "" });
  async function save() {
    const { error } = await supabase.from("expenses").insert({
      spent_on: f.spent_on,
      category: f.category,
      amount: Number(f.amount),
      cottage_id: f.cottage_id === "resort" ? null : f.cottage_id,
      note: f.note,
      created_by: (await supabase.auth.getUser()).data.user?.email,
    });
    if (error) return void toast.error(error.message);
    toast.success("Expense recorded");
    qc.invalidateQueries({ queryKey: ["expenses"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-xl">Record expense</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="ex-d">Date</Label><Input id="ex-d" type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ex-a">Amount</Label><Input id="ex-a" type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>For</Label>
            <Select value={f.cottage_id} onValueChange={(v) => setF({ ...f, cottage_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resort">Whole resort</SelectItem>
                {cottages.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ex-n">Note</Label><Input id="ex-n" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.amount} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
