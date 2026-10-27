import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Hourglass, MessageCircle, type LucideIcon } from "@/components/icons";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { niceDate, niceDateTime, php, SLOT_LABEL, type Slot } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * Malaya's action strip: what needs doing, as one slim row at the top of the
 * Dashboard. Each concern is a chip in its colour with a one-line summary and
 * the amount; it opens the full list in a side panel, each row a link to
 * where it is handled. Nothing to do shows a small green ✓ instead, so an
 * empty strip still says it was checked.
 */
type Tone = "urgent" | "verify" | "chat";

const TONE: Record<Tone, { chip: string; icon: string; amount: string }> = {
  urgent: { chip: "border-destructive/35 bg-destructive/5 hover:bg-destructive/10", icon: "bg-destructive/15 text-destructive", amount: "text-destructive" },
  verify: { chip: "border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10", icon: "bg-amber-500/15 text-amber-700", amount: "text-amber-700" },
  chat: { chip: "border-border bg-card hover:bg-secondary/60", icon: "bg-secondary text-foreground", amount: "text-foreground" },
};

function Chip({ tone, icon: Icon, title, sub, amount, onOpen }: { tone: Tone; icon: LucideIcon; title: string; sub: string; amount?: string; onOpen: () => void }) {
  const t = TONE[tone];
  return (
    <button type="button" onClick={onOpen} className={cn("group flex min-w-0 flex-1 basis-72 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors", t.chip)}>
      <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", t.icon)}>
        <Icon className="size-4" aria-hidden />
        {tone === "urgent" && <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-destructive ring-2 ring-background" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground max-sm:line-clamp-2 sm:truncate">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      {amount && <span className={cn("shrink-0 text-sm font-semibold tabular-nums", t.amount)}>{amount}</span>}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

const Clear = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-3 py-1.5 text-xs text-foreground">
    <CheckCircle2 className="size-3.5 text-success" aria-hidden /> {children}
  </span>
);

type Row = { key: string; to: string; title: string; sub: string; amount?: string };

function Panel({ open, onOpenChange, title, sub, rows }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; sub: string; rows: Row[] }) {
  const router = useRouter();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-display text-xl">{title}</SheetTitle>
          <SheetDescription>{sub}</SheetDescription>
        </SheetHeader>
        <ul className="mt-5 divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => { onOpenChange(false); router.history.push(r.to); }} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left hover:bg-secondary/60">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                </span>
                {r.amount && <span className="shrink-0 text-sm font-semibold tabular-nums">{r.amount}</span>}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

const names = (list: string[]) => (list.length <= 2 ? list.join(", ") : `${list.slice(0, 2).join(", ")} +${list.length - 2} more`);

export function ActionStrip() {
  const [open, setOpen] = useState<"settle" | "verify" | "chat" | null>(null);
  const q = useQuery({
    queryKey: ["action-strip"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [receipts, settle, chats] = await Promise.all([
        supabase.from("payments").select("id, amount, created_at, booking_id, bookings(code, stay_date, slot, guests(name), cottages(name))").eq("status", "submitted").order("created_at"),
        supabase.from("bookings").select("id, code, estimate, stay_date, slot, guests(name), cottages(name), payments(amount, kind, status)").not("checked_out_at", "is", null).in("status", ["confirmed", "checked_in"]),
        supabase.from("threads").select("id, last_message_at, guests(name), messages(body, created_at)").eq("unread", true).order("last_message_at", { ascending: false }).order("created_at", { referencedTable: "messages", ascending: false }).limit(1, { referencedTable: "messages" }),
      ]);
      return { receipts: (receipts.data ?? []) as any[], settle: (settle.data ?? []) as any[], chats: (chats.data ?? []) as any[] };
    },
  });
  if (!q.data) return <div className="h-[58px]" />;
  const { receipts, settle, chats } = q.data;

  const balance = (b: any) => Math.max(0, Number(b.estimate) - (b.payments ?? []).filter((p: any) => p.status === "verified").reduce((s: number, p: any) => s + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0));
  const owed = settle.reduce((s, b) => s + balance(b), 0);
  const toVerify = receipts.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <section aria-label="Needs action" className="flex flex-wrap items-center gap-2.5">
      {settle.length ? (
        <Chip tone="urgent" icon={AlertTriangle} title={`${settle.length} guest${settle.length === 1 ? "" : "s"} to settle`} sub={`Checked out, final not logged · ${names(settle.map((b) => b.guests?.name ?? "Guest"))}`} amount={php(owed)} onOpen={() => setOpen("settle")} />
      ) : (
        <Clear>Everyone who left has settled</Clear>
      )}
      {receipts.length ? (
        <Chip tone="verify" icon={Hourglass} title={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"} to verify`} sub={`Online downpayments · ${names(receipts.map((p) => p.bookings?.guests?.name ?? "Guest"))}`} amount={php(toVerify)} onOpen={() => setOpen("verify")} />
      ) : (
        <Clear>No receipts waiting</Clear>
      )}
      {chats.length > 0 && (
        <Chip tone="chat" icon={MessageCircle} title={`${chats.length} unread chat${chats.length === 1 ? "" : "s"}`} sub={names(chats.map((t) => t.guests?.name ?? "Guest"))} onOpen={() => setOpen("chat")} />
      )}

      <Panel
        open={open === "settle"}
        onOpenChange={(o) => setOpen(o ? "settle" : null)}
        title="Guests to settle"
        sub="Checked out without the final amount logged. Open one and press Settle."
        rows={settle.map((b) => ({ key: b.id, to: `/admin/bookings/${b.id}`, title: b.guests?.name ?? "Guest", sub: `${b.code} · ${b.cottages?.name} · ${niceDate(b.stay_date)} ${SLOT_LABEL[b.slot as Slot]}`, amount: php(balance(b)) }))}
      />
      <Panel
        open={open === "verify"}
        onOpenChange={(o) => setOpen(o ? "verify" : null)}
        title="Receipts to verify"
        sub="Not confirmed until someone checks the payment arrived. Open one to view the receipt."
        rows={receipts.map((p) => ({ key: p.id, to: `/admin/bookings/${p.booking_id}`, title: p.bookings?.guests?.name ?? "Guest", sub: `${p.bookings?.code} · ${p.bookings?.cottages?.name} · sent ${niceDateTime(p.created_at)}`, amount: php(p.amount) }))}
      />
      <Panel
        open={open === "chat"}
        onOpenChange={(o) => setOpen(o ? "chat" : null)}
        title="Unread chats"
        sub="Guests waiting on a reply."
        rows={chats.map((t) => ({ key: t.id, to: `/admin/inbox?t=${t.id}`, title: t.guests?.name ?? "Guest", sub: t.messages?.[0]?.body ?? "" }))}
      />
    </section>
  );
}
