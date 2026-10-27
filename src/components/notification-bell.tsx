import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Bell, CheckCircle2, MessageCircle, Wallet } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { niceDateTime } from "@/lib/format";
import { useAdminNotices, useGuestNotices, useLastSeen, type Notice } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const TONE: Record<Notice["tone"], { icon: typeof Bell; cls: string }> = {
  good: { icon: CheckCircle2, cls: "bg-success/12 text-success" },
  bad: { icon: AlertCircle, cls: "bg-destructive/10 text-destructive" },
  info: { icon: MessageCircle, cls: "bg-secondary text-foreground" },
  money: { icon: Wallet, cls: "bg-warning/15 text-warning" },
};

function Bell_({ items, loading, className, empty }: { items: Notice[] | undefined; loading: boolean; className?: string; empty: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { seen, markSeen } = useLastSeen(session?.user.email ?? undefined);
  const unread = (items ?? []).filter((n) => !seen || n.at > seen).length;
  const go = (n: Notice) => {
    setOpen(false);
    router.history.push(n.to);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) markSeen();
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label={unread ? `Notifications, ${unread} new` : "Notifications"} className={cn("relative grid size-9 place-items-center rounded-full text-foreground/75 hover:bg-secondary hover:text-foreground", className)}>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <p className="font-display text-base">Notifications</p>
          {unread > 0 && (
            <button type="button" onClick={markSeen} className="text-xs text-muted-foreground hover:text-foreground">Mark all read</button>
          )}
        </div>
        <div className="max-h-[min(28rem,70dvh)] overflow-y-auto p-1.5">
          {loading && !items ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : !items?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>
          ) : (
            items.map((n) => {
              const t = TONE[n.tone];
              const isNew = !seen || n.at > seen;
              return (
                <button key={n.id} type="button" onClick={() => go(n)} className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-secondary/60">
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", t.cls)}><t.icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", isNew ? "font-semibold" : "font-medium")}>{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-muted-foreground">{n.sub}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{niceDateTime(n.at)}</span>
                  </span>
                  {isNew && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AdminBell({ className }: { className?: string }) {
  const router = useRouter();
  const q = useAdminNotices((n) => router.history.push(n.to));
  return <Bell_ items={q.data} loading={q.isLoading} className={className} empty="Nothing new. Bookings, receipts and guest messages show up here." />;
}

export function GuestBell({ className }: { className?: string }) {
  const router = useRouter();
  const q = useGuestNotices((n) => router.history.push(n.to));
  return <Bell_ items={q.data} loading={q.isLoading} className={className} empty="Nothing yet. Confirmations and replies from the resort show up here." />;
}
