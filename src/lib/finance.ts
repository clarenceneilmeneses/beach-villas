import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { allRows, rpc, supabase } from "./supabase";
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

/** Verified payments made in a date range (Manila days), every one of them. */
export function usePayments(from: string, to: string) {
  return useQuery({
    queryKey: ["payments", from, to],
    queryFn: () =>
      allRows<any>(() =>
        supabase
          .from("payments")
          .select("id, booking_id, kind, method, amount, status, created_by, created_at, edited, bookings(code, cottage_id, cottages(name), guests(name))")
          .eq("status", "verified")
          .gte("created_at", manilaDayStart(from))
          .lt("created_at", manilaDayStart(addDays(to, 1)))
          .order("created_at", { ascending: false })
          .order("id"),
      ),
  });
}

export type Summary = {
  collected: number;
  payments: number;
  downpayments: number;
  finals: number;
  refunds: number;
  by_method: { method: string; total: number }[];
  expenses: number;
  by_category: { category: string; total: number }[];
  bookings: number;
  cancelled: number;
  settled: number;
  by_slot: { slot: string; n: number }[];
  halves: number;
  capacity: number;
  discounts: number;
  daily: { d: string; collected: number; expenses: number }[];
  cottages: { id: string; name: string; collected: number; expenses: number; bookings: number; day: number; night: number; h22: number; halves: number; discounts: number }[];
};

/** Every Finance number for a range, worked out by the database (migrations/005). */
export function useSummary(from: string, to: string, cottageIds: Set<string> | null) {
  const ids = cottageIds ? [...cottageIds].sort() : null;
  return useQuery({
    queryKey: ["finance-summary", from, to, ids?.join(",") ?? "all"],
    queryFn: () =>
      rpc<Summary>("finance_summary", { p_from: from, p_to: to, p_cottages: ids }).catch((e: Error) => {
        // Until migration 005 runs, PostgREST can't find the function.
        throw /finance_summary/.test(e.message) && /schema cache|could not find/i.test(e.message)
          ? new Error("Finance totals need a database update: run supabase/migrations/005_finance_summary.sql in the Supabase SQL Editor, then reload.")
          : e;
      }),
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
