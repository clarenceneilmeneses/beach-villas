import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { addDays, manilaDayStart, manilaToday } from "./format";

export type Period = "today" | "7d" | "month" | "last_month";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

export function range(p: Period) {
  const today = manilaToday();
  let from = today;
  let to = today;
  if (p === "7d") from = addDays(today, -6);
  if (p === "month") from = `${today.slice(0, 8)}01`;
  if (p === "last_month") {
    to = addDays(`${today.slice(0, 8)}01`, -1);
    from = `${to.slice(0, 8)}01`;
  }
  return { from, to, days: Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1 };
}

export const signed = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -1 : 1) * Number(p.amount);

/** Verified payments made in a date range (Manila days). */
export function usePayments(from: string, to: string) {
  return useQuery({
    queryKey: ["payments", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, booking_id, kind, method, amount, status, created_by, created_at, edited, bookings(code, cottages(name), guests(name))")
        .eq("status", "verified")
        .gte("created_at", manilaDayStart(from))
        .lt("created_at", manilaDayStart(addDays(to, 1)))
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return void toast.error("Nothing to export");
  const keys = Object.keys(rows[0]!);
  const body = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = name;
  a.click();
}
