import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SectionHeading } from "@/components/obs/cards";
import { SearchPill } from "@/components/obs/search-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/obs/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { niceDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings/guests")({ component: Guests });

function Guests() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["guests", search],
    queryFn: async () => {
      let query = supabase.from("guests").select("id, name, mobile, email, created_at, bookings(stay_date, status)").order("created_at", { ascending: false }).limit(200);
      const s = search.trim();
      if (s) query = query.or(`name.ilike.%${s}%,mobile.ilike.%${s}%,email.ilike.%${s}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = (q.data ?? []).map((g) => {
    const stays = (g.bookings ?? []).filter((b: any) => !["cancelled", "expired", "blocked"].includes(b.status));
    const last = stays.map((b: any) => b.stay_date).sort().at(-1);
    return { ...g, visits: stays.length, last };
  });
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
                {rows.map((g) => (
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
    </div>
  );
}
