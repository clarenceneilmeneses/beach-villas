import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, MessageCircle, Phone, Send } from "@/components/icons";
import { useNavPillAway } from "@/components/nav-pill";
import { useBookingDialog } from "@/components/obs/booking-dialog";
import { StatusPill } from "@/components/obs/booking-bits";
import { ChipGroup } from "@/components/obs/chip-group";
import { SearchPill } from "@/components/obs/search-pill";
import { ErrorState } from "@/components/obs/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { niceDate, niceDateTime, php, SLOT_LABEL, type Slot } from "@/lib/format";
import { rpc, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inbox")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => (typeof s.t === "string" ? { t: s.t } : {}),
  component: Inbox,
});

const CHANNEL: Record<string, string> = { messenger: "Messenger", whatsapp: "WhatsApp", viber: "Viber", phone: "Phone" };
const CHANNEL_TONE: Record<string, string> = {
  messenger: "bg-primary/10 text-primary border-primary/25",
  whatsapp: "bg-success/12 text-success border-success/30",
  viber: "bg-secondary text-foreground/75 border-border",
  phone: "bg-secondary text-foreground/75 border-border",
};
type Filter = "all" | "reply" | "unread";

function Inbox() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const threads = useQuery({
    queryKey: ["inbox", "threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, channel, unread, last_message_at, guests(name, mobile), messages(author, body, created_at)")
        .order("last_message_at", { ascending: false })
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" });
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });
  if (threads.error) return <ErrorState error={threads.error} onRetry={() => threads.refetch()} />;

  const all = threads.data ?? [];
  const needsReply = all.filter((r) => r.messages?.[0]?.author === "guest");
  const rows = all
    .filter((r) => (filter === "unread" ? r.unread : filter === "reply" ? r.messages?.[0]?.author === "guest" : true))
    .filter((r) => !search.trim() || `${r.guests?.name} ${r.guests?.mobile}`.toLowerCase().includes(search.trim().toLowerCase()));

  const list = (
    <Card className={cn("flex min-h-0 flex-col border-border/70 bg-surface shadow-level-2", t && "hidden lg:flex")}>
      <div className="space-y-2.5 border-b border-border/70 p-3">
        <ChipGroup label="Conversations" value={filter} onChange={setFilter} chips={[
          { value: "all", label: "All", count: all.length },
          { value: "reply", label: "Needs reply", count: needsReply.length, waiting: true },
          { value: "unread", label: "Unread", count: all.filter((r) => r.unread).length, waiting: true },
        ]} />
        <SearchPill className="sm:min-w-0" placeholder="Search guest or mobile" value={search} onChange={setSearch} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{threads.isLoading ? "Loading…" : "No conversations here."}</p>}
        {rows.map((r) => {
          const last = r.messages?.[0];
          return (
            <button key={r.id} onClick={() => navigate({ to: "/admin/inbox", search: { t: r.id } })} className={cn("flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-secondary/60", r.id === t && "bg-secondary")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm">{(r.guests?.name ?? "?")[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", r.unread ? "font-semibold" : "font-medium")}>{r.guests?.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{niceDateTime(r.last_message_at)}</span>
                </span>
                <span className={cn("block truncate text-xs", r.unread ? "text-foreground" : "text-muted-foreground")}>{last?.author === "staff" ? "You: " : ""}{last?.body}</span>
                <Badge variant="outline" className={cn("mt-1 rounded-full px-2 py-0 text-[10px]", CHANNEL_TONE[r.channel])}>{CHANNEL[r.channel]}</Badge>
              </span>
              {r.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-3 lg:h-full">
      <div className="rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-level-1">
        Messenger connects here once Meta approves the app; until then these are sample chats. WhatsApp and Viber stay in their own apps — use Copy on a quick reply.
      </div>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[360px_1fr]">
        {list}
        {t ? <Thread id={t} onBack={() => navigate({ to: "/admin/inbox", search: {} })} /> : (
          <Card className="hidden place-items-center border-dashed shadow-none lg:grid">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 size-6" />
              <p className="text-sm">Pick a conversation</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const booking = useBookingDialog();
  const [text, setText] = useState("");
  useNavPillAway(true);
  const q = useQuery({
    queryKey: ["inbox", "thread", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, channel, unread, guests(id, name, mobile, bookings(id, code, stay_date, slot, status, estimate, checked_out_at)), messages(id, author, body, created_at, by_email)")
        .eq("id", id)
        .order("created_at", { referencedTable: "messages" })
        .single();
      if (error) throw new Error(error.message);
      return data as any;
    },
  });
  const replies = useQuery({ queryKey: ["quick-replies"], queryFn: async () => (await supabase.from("quick_replies").select("*").order("sort")).data ?? [] });

  useEffect(() => {
    if (q.data?.unread) void supabase.from("threads").update({ unread: false }).eq("id", id).then(() => qc.invalidateQueries({ queryKey: ["nav-counts"] }));
  }, [q.data?.unread, id, qc]);

  if (!q.data) return <Card className="border-border/70 bg-surface p-6 text-sm text-muted-foreground shadow-level-2">Loading…</Card>;
  const th = q.data;
  const live = th.channel === "messenger";

  async function send() {
    if (!text.trim()) return;
    try {
      await rpc("send_message", { p_thread: id, p_body: text.trim() });
      setText("");
      qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card className="flex min-h-[70dvh] flex-col border-border/70 bg-surface shadow-level-2 lg:min-h-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
        <Button variant="ghost" size="icon" className="rounded-full lg:hidden" onClick={onBack} aria-label="Back"><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg">{th.guests?.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {CHANNEL[th.channel]}
            {th.guests?.mobile && <a href={`tel:${th.guests.mobile}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="size-3.5" /> {th.guests.mobile}</a>}
          </p>
        </div>
        <Button size="sm" onClick={() => booking.open({ source: th.channel === "phone" ? "phone" : th.channel, name: th.guests?.name, mobile: th.guests?.mobile })}>Create booking</Button>
      </div>

      {th.guests?.bookings?.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border/70 px-4 py-2.5">
          {th.guests.bookings.map((b: any) => (
            <Link key={b.id} to="/admin/bookings/$id" params={{ id: b.id }} className="shrink-0 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs hover:bg-secondary/60">
              <p className="font-medium">{b.code} · {niceDate(b.stay_date)}</p>
              <p className="text-muted-foreground">{SLOT_LABEL[b.slot as Slot]} · {php(b.estimate)}</p>
              <StatusPill status={b.status} checkedOut={!!b.checked_out_at} className="mt-1" />
            </Link>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {th.messages.map((m: any) => (
          <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", m.author === "staff" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary")}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={cn("mt-0.5 text-[10px]", m.author === "staff" ? "text-primary-foreground/60" : "text-muted-foreground")}>{niceDateTime(m.created_at)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border/70 p-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {replies.data?.map((r: any) => (
            <span key={r.id} className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-border/70 bg-card text-xs shadow-level-1">
              <button onClick={() => setText(r.body)} className="px-3 py-1.5 hover:bg-secondary">{r.title}</button>
              <button onClick={() => { void navigator.clipboard.writeText(r.body); toast.success(`Copied — paste it in ${CHANNEL[th.channel]}`); }} className="border-l border-border/70 px-2 py-1.5 hover:bg-secondary" aria-label={`Copy ${r.title}`}>
                <Copy className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={live ? "Reply on Messenger…" : `Log what you sent on ${CHANNEL[th.channel]}…`} className="min-h-[44px] resize-none" />
          <Button onClick={send} size="icon" className="size-11 shrink-0 rounded-full" aria-label="Send"><Send className="size-4" /></Button>
        </div>
        {!live && <p className="text-[11px] text-muted-foreground">{CHANNEL[th.channel]} replies go out from the {CHANNEL[th.channel]} app; this keeps a copy on the guest.</p>}
      </div>
    </Card>
  );
}
