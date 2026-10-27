import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/lib/supabase";
import { SLOT_LABEL, type Slot } from "@/lib/format";
import { cn } from "@/lib/utils";

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

/** The board's 28 halves as 14 cottages, in the board's order. */
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
  free: "border border-dashed border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/50",
  booked: "bg-primary/[0.14] text-foreground",
  in: "bg-success/12 text-success",
  pending: "bg-warning/12 text-warning",
  blocked: "border border-border bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-border)_6px_7px)] text-muted-foreground",
  settled: "bg-secondary text-foreground/55",
  unsettled: "bg-warning/20 text-warning",
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
    <div className={cn("flex flex-wrap gap-1.5 text-[11px]", className)}>
      {Object.keys(HALF_STYLE).map((k) => (
        <span key={k} className={cn("rounded-full px-2.5 py-0.5 font-medium", HALF_STYLE[k])}>{HALF_LABEL[k]}</span>
      ))}
    </div>
  );
}

/** One half of a cottage tile: Day or Night. */
export function Half({ h, label, onClick }: { h?: BoardHalf; label: string; onClick: () => void }) {
  const st = halfState(h);
  const both = h?.slot === "h22" || h?.slot === "day_night";
  return (
    <button onClick={onClick} className={cn("flex min-h-[58px] flex-col items-start rounded-xl px-2.5 py-2 text-left transition active:scale-95", HALF_STYLE[st])}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
        {label}
        {both ? ` · ${SLOT_LABEL[h!.slot as Slot]}` : ""}
      </span>
      <span className="line-clamp-1 text-[13px] font-medium">{st === "free" ? "Free" : st === "blocked" ? h?.block_reason : h?.guest_name}</span>
      {st !== "free" && st !== "blocked" && (
        <span className="text-[11px] opacity-75">{HALF_LABEL[st]}{h?.pax ? ` · ${h.pax} pax` : ""}</span>
      )}
    </button>
  );
}
