import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SectionHeading } from "@/components/obs/cards";
import { PaginationBar, usePagination } from "@/components/obs/paginated";
import { SearchPill } from "@/components/obs/search-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { niceDate } from "@/lib/format";
import { allRows, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings/guests")({ component: Guests });

function Guests() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["guests", search],
    queryFn: async () => {
      const s = search.trim();
      return allRows<any>(() => {
        let query = supabase.from("guests").select("id, name, mobile, email, created_at, bookings(stay_date, status)").order("created_at", { ascending: false }).order("id");
        if (s) query = query.or(`name.ilike.%${s}%,mobile.ilike.%${s}%,email.ilike.%${s}%`);
        return query;
      });
    },
  });
  const rows = (q.data ?? []).map((g) => {
    const stays = (g.bookings ?? []).filter((b: any) => !["cancelled", "expired", "blocked"].includes(b.status));
    const last = stays.map((b: any) => b.stay_date).sort().at(-1);
    return { ...g, visits: stays.length, last };
  });
  const paged = usePagination(rows, { initialPageSize: 50, resetKey: search });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`${rows.length} guests`} title="Guest list" action={<SearchPill placeholder="Search name, mobile or email" value={search} onChange={setSearch} />} />
      {q.isLoading ? <LoadingState /> : rows.length === 0 ? <EmptyState title="No guests yet" /> : (
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Last stay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.page.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{g.mobile || g.email}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{[g.mobile, g.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.visits}</TableCell>
                    <TableCell className="text-right text-sm">{g.last ? niceDate(g.last) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {rows.length > 0 && <PaginationBar pagination={paged} noun="guests" />}
    </div>
  );
}
