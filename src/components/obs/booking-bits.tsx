// Malaya's booking pills (components/obs/booking-bits.tsx), on this system's statuses.
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { METHOD_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/12 text-warning border-warning/30",
  confirmed: "bg-primary/10 text-primary border-primary/25",
  checked_in: "bg-success/12 text-success border-success/30",
  settled: "bg-secondary text-foreground/70 border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  no_show: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  blocked: "bg-muted text-muted-foreground border-border",
  to_settle: "bg-warning/12 text-warning border-warning/30",
};

const PILL = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap";

/** A booking's state, with "To settle" for a guest who left without settling. */
export function StatusPill({ status, checkedOut, className }: { status: string; checkedOut?: boolean | null; className?: string }) {
  const key = checkedOut && status !== "settled" && status !== "cancelled" ? "to_settle" : status;
  return (
    <Badge variant="outline" className={cn(PILL, STATUS_TONE[key] ?? "bg-secondary text-foreground/70 border-border", className)}>
      {key === "to_settle" ? "To settle" : STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const PAYMENT_TONE: Record<string, string> = {
  submitted: "bg-warning/12 text-warning border-warning/30",
  verified: "bg-success/12 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

export function PaymentPill({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(PILL, PAYMENT_TONE[status])}>
      {status === "submitted" ? "Under verification" : status === "verified" ? "Verified" : "Rejected"}
    </Badge>
  );
}

export function SourcePill({ source }: { source: string }) {
  return (
    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
      {SOURCE_LABEL[source] ?? source}
    </Badge>
  );
}

export function MethodPill({ method }: { method: string }) {
  return (
    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
      {METHOD_LABEL[method] ?? method}
    </Badge>
  );
}
