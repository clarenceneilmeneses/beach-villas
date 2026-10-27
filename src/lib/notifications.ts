import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import { addDays, manilaToday, METHOD_LABEL, niceDate, php, SLOT_LABEL, type Slot } from "./format";
import { supabase } from "./supabase";

/**
 * Notifications, built from what the system already records — the activity
 * log and messages for staff, a guest's own bookings, payments and thread for
 * guests — so nothing new is stored. "Read" is the moment the bell was last
 * opened, kept per account in this browser.
 */
export type Notice = {
  id: string;
  at: string;
  title: string;
  sub: string;
  to: string;
  tone: "good" | "bad" | "info" | "money";
};

const seenKey = (email: string) => `beach:notices-seen:${email}`;
const listeners = new Set<() => void>();

export function useLastSeen(email: string | undefined) {
  const read = () => {
    if (!email || typeof window === "undefined") return "";
    try {
      return localStorage.getItem(seenKey(email)) ?? "";
    } catch {
      return "";
    }
  };
  const seen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "",
  );
  const markSeen = () => {
    if (!email) return;
    try {
      localStorage.setItem(seenKey(email), new Date().toISOString());
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  };
  return { seen, markSeen };
}

/**
 * Pops a toast for anything that arrives while the page is open (not on first
 * load). Shared per kind, because the laptop and phone bars each mount a bell
 * and one arrival must toast once.
 */
const toasted: Record<string, Set<string> | undefined> = {};
function useToastNew(kind: string, items: Notice[] | undefined, onOpen: (n: Notice) => void) {
  useEffect(() => {
    if (!items) return;
    const known = toasted[kind];
    if (!known) {
      toasted[kind] = new Set(items.map((n) => n.id));
      return;
    }
    for (const n of items) {
      if (known.has(n.id)) continue;
      known.add(n.id);
      toast(n.title, { description: n.sub, action: { label: "Open", onClick: () => onOpen(n) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}

const ADMIN_TEXT: Record<string, { title: string; tone: Notice["tone"] }> = {
  "online booking": { title: "New online booking", tone: "info" },
  "receipt uploaded": { title: "Receipt to verify", tone: "money" },
  "payment edited": { title: "A payment was edited", tone: "bad" },
  "walk-in": { title: "Walk-in added", tone: "info" },
  "booking added": { title: "Booking added", tone: "info" },
  settled: { title: "Booking settled", tone: "good" },
  "downpayment verified": { title: "Downpayment verified", tone: "good" },
  "downpayment rejected": { title: "Receipt rejected", tone: "bad" },
  cancel: { title: "Booking cancelled", tone: "bad" },
  no_show: { title: "Marked no-show", tone: "bad" },
  "extended to overnight": { title: "Extended to overnight", tone: "info" },
};

export function useAdminNotices(onOpen: (n: Notice) => void) {
  const { session } = useAuth();
  const me = session?.user.email?.toLowerCase();
  const q = useQuery({
    queryKey: ["notices", "admin", me],
    enabled: !!me,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [log, msgs] = await Promise.all([
        supabase
          .from("activity_log")
          .select("id, at, actor, action, detail, booking_id, bookings(code, guests(name), cottages(name))")
          .order("at", { ascending: false })
          .limit(40),
        supabase
          .from("messages")
          .select("id, body, created_at, thread_id, threads(guests(name))")
          .eq("author", "guest")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const items: Notice[] = [];
      for (const l of (log.data ?? []) as any[]) {
        const t = ADMIN_TEXT[l.action];
        if (!t || (l.actor ?? "").toLowerCase() === me) continue;
        const b = l.bookings;
        items.push({
          id: `log-${l.id}`,
          at: l.at,
          title: t.title,
          sub: [b?.guests?.name, b?.cottages?.name, b?.code, l.action === "payment edited" ? l.detail : null].filter(Boolean).join(" · ") + (l.actor && l.action !== "online booking" && l.action !== "receipt uploaded" ? ` · by ${l.actor.split("@")[0]}` : ""),
          to: l.booking_id ? `/admin/bookings/${l.booking_id}` : "/admin",
          tone: t.tone,
        });
      }
      for (const m of (msgs.data ?? []) as any[]) {
        items.push({ id: `msg-${m.id}`, at: m.created_at, title: `Message from ${m.threads?.guests?.name ?? "a guest"}`, sub: m.body, to: `/admin/inbox?t=${m.thread_id}`, tone: "info" });
      }
      return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
    },
  });
  useToastNew("admin", q.data, onOpen);
  return q;
}

export function useGuestNotices(onOpen: (n: Notice) => void) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const [resort, setResort] = useState("the resort");
  // Each bell its own channel: two subscribers on one name throws.
  const channelId = useId();
  const q = useQuery({
    queryKey: ["notices", "guest", uid],
    enabled: !!uid,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [b, t, s] = await Promise.all([
        supabase.from("bookings").select("id, code, stay_date, slot, status, cottages(name), payments(id, kind, method, amount, status, verified_at)").eq("user_id", uid!),
        supabase.from("threads").select("id, messages(id, author, body, created_at), guests!inner(user_id)").eq("guests.user_id", uid!).maybeSingle(),
        supabase.from("settings").select("resort_name").eq("id", 1).maybeSingle(),
      ]);
      if (s.data?.resort_name) setResort(s.data.resort_name);
      const items: Notice[] = [];
      const today = manilaToday();
      for (const bk of (b.data ?? []) as any[]) {
        const where = `${bk.code} · ${bk.cottages?.name ?? ""} · ${niceDate(bk.stay_date)} ${SLOT_LABEL[bk.slot as Slot]}`;
        for (const p of bk.payments ?? []) {
          if (p.kind !== "downpayment" || !p.verified_at) continue;
          items.push(
            p.status === "verified"
              ? { id: `pay-${p.id}`, at: p.verified_at, title: "Your booking is confirmed", sub: `${php(p.amount)} ${METHOD_LABEL[p.method] ?? ""} verified · ${where}`, to: "/my", tone: "good" }
              : { id: `pay-${p.id}`, at: p.verified_at, title: "We couldn't verify your receipt", sub: `Please send it again or message us · ${where}`, to: "/my", tone: "bad" },
          );
        }
        if (bk.status === "confirmed" && (bk.stay_date === today || bk.stay_date === addDays(today, 1))) {
          items.push({ id: `soon-${bk.id}-${bk.stay_date}`, at: `${today}T00:00:00+08:00`, title: bk.stay_date === today ? "Your stay is today" : "Your stay is tomorrow", sub: where, to: "/my", tone: "info" });
        }
      }
      for (const m of ((t.data?.messages ?? []) as any[]).filter((x) => x.author === "staff")) {
        items.push({ id: `msg-${m.id}`, at: m.created_at, title: "New reply", sub: m.body, to: "/messages", tone: "info" });
      }
      return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
    },
  });
  // A staff reply or a verification arrives while the page is open.
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`guest-notices-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["notices", "guest"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => qc.invalidateQueries({ queryKey: ["notices", "guest"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc]);
  useToastNew("guest", q.data, onOpen);
  return { ...q, resort };
}
