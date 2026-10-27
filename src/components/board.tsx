import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/lib/supabase";
import { cn } from "@/lib/format";

export type BoardHalf = {
  cottage_id: string;
  cottage_name: string;
  type_id: string;
  type_name: string;
  half: "day" | "night";
  booking_id: string | null;
  code: string | null;
  guest_name: string | null;
  status: string | null;
  slot: string | null;
  source: string | null;
  pax: number | null;
  block_reason: string | null;
  checked_out_at: string | null;
};

export function useBoard(date: string) {
  return useQuery({ queryKey: ["board", date], queryFn: () => rpc<BoardHalf[]>("board", { p_date: date }) });
}

/** Group the 28 halves into 14 cottages, keeping the board's order. */
export function byCottage(rows: BoardHalf[]) {
  const map = new Map<string, { id: string; name: string; type: string; day?: BoardHalf; night?: BoardHalf }>();
  for (const r of rows) {
    const c = map.get(r.cottage_id) ?? { id: r.cottage_id, name: r.cottage_name, type: r.type_name };
    c[r.half] = r;
    map.set(r.cottage_id, c);
  }
  return [...map.values()];
}

export function halfState(h?: BoardHalf) {
  if (!h?.booking_id) return "free";
  if (h.status === "blocked") return "blocked";
  if (h.status === "pending") return "pending";
  if (h.status === "settled") return "settled";
  if (h.checked_out_at) return "unsettled";
  if (h.status === "checked_in") return "in";
  return "booked";
}

export const HALF_STYLE: Record<string, string> = {
  free: "border border-dashed border-neutral-300 bg-white text-neutral-400",
  booked: "bg-sky-100 text-sky-900",
  in: "bg-emerald-100 text-emerald-900",
  pending: "bg-amber-100 text-amber-900",
  blocked: "bg-neutral-200 text-neutral-600",
  settled: "bg-neutral-100 text-neutral-500",
  unsettled: "bg-orange-100 text-orange-900",
};

export const HALF_LABEL: Record<string, string> = {
  free: "Free",
  booked: "Booked",
  in: "In house",
  pending: "Pending",
  blocked: "Blocked",
  settled: "Settled",
  unsettled: "To settle",
};

export function Legend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2 text-[11px]", className)}>
      {Object.keys(HALF_STYLE).map((k) => (
        <span key={k} className={cn("rounded-full px-2 py-0.5", HALF_STYLE[k])}>{HALF_LABEL[k]}</span>
      ))}
    </div>
  );
}
