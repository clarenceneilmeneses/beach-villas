import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Slot } from "./format";

export type BookingRow = {
  id: string;
  code: string;
  stay_date: string;
  slot: Slot;
  status: string;
  source: string;
  pax_adults: number;
  pax_children: number;
  estimate: number;
  final_amount: number | null;
  checked_out_at: string | null;
  created_at: string;
  created_by: string | null;
  cottages: { name: string; cottage_types: { name: string } | null } | null;
  guests: { name: string; mobile: string } | null;
  payments: { amount: number; kind: string; status: string }[];
};

export const BOOKING_COLS =
  "id, code, stay_date, slot, status, source, pax_adults, pax_children, estimate, final_amount, checked_out_at, created_at, created_by, cottages(name, cottage_types(name)), guests(name, mobile), payments(amount, kind, status)";

export const collectedOf = (b: Pick<BookingRow, "payments">) =>
  (b.payments ?? []).filter((p) => p.status === "verified").reduce((s, p) => s + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0);

export const pax = (b: Pick<BookingRow, "pax_adults" | "pax_children">) => b.pax_adults + b.pax_children;

/** Bookings, newest stay first, optionally searched by name, mobile or BK- number. */
export function useBookings({ search = "", from, to, limit = 300 }: { search?: string; from?: string; to?: string; limit?: number }) {
  return useQuery({
    queryKey: ["bookings", search, from, to, limit],
    queryFn: async () => {
      let q = supabase.from("bookings").select(BOOKING_COLS).neq("status", "blocked").order("stay_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
      if (from) q = q.gte("stay_date", from);
      if (to) q = q.lte("stay_date", to);
      const s = search.trim();
      if (s) {
        const { data: g } = await supabase.from("guests").select("id").or(`name.ilike.%${s}%,mobile.ilike.%${s}%`).limit(100);
        const ids = (g ?? []).map((x) => x.id);
        q = q.or(`code.ilike.%${s}%${ids.length ? `,guest_id.in.(${ids.join(",")})` : ""}`);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as BookingRow[];
    },
  });
}
