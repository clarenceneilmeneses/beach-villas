import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft01Icon, Copy01Icon, MessengerIcon, SentIcon, ViberIcon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { BookingSheet } from "@/components/booking-sheet";
import { Badge, Button, Card, Empty, Icon, SchemaNotice, Segmented, Spinner, statusTone } from "@/components/ui";
import { cn, money, niceDate, niceDateTime, SLOT_LABEL, STATUS_LABEL, type Slot } from "@/lib/format";
import { rpc, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/inbox")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => (typeof s.t === "string" ? { t: s.t } : {}),
  component: Inbox,
});

const CHANNEL = {
  messenger: { label: "Messenger", icon: MessengerIcon },
  whatsapp: { label: "WhatsApp", icon: WhatsappIcon },
  viber: { label: "Viber", icon: ViberIcon },
  phone: { label: "Phone", icon: MessengerIcon },
} as const;

type Filter = "reply" | "unread" | "all";

function Inbox() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const threads = useQuery({
    queryKey: ["inbox", "threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, channel, unread, last_message_at, guest_id, guests(name, mobile), messages(author, body, created_at)")
        .order("last_message_at", { ascending: false })
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" });
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });

  if (t) return <Thread id={t} onBack={() => navigate({ to: "/admin/inbox", search: {} })} />;
  if (threads.error) return <SchemaNotice error={threads.error} />;

  const rows = (threads.data ?? []).filter((r) =>
    filter === "unread" ? r.unread : filter === "reply" ? r.messages?.[0]?.author === "guest" : true,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <Card className="border-sky-200 bg-sky-50 text-sm text-sky-900">
        Messenger connects here once Meta approves the app. WhatsApp and Viber stay in their apps — use the Copy buttons on quick replies. These are sample chats.
      </Card>
      <Segmented<Filter> value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "reply", label: "Needs reply" }, { value: "unread", label: "Unread" }]} />
      {threads.isLoading ? <Spinner /> : rows.length === 0 ? <Empty title="Nothing here" /> : (
        <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {rows.map((r) => {
            const ch = CHANNEL[r.channel as keyof typeof CHANNEL];
            const last = r.messages?.[0];
            return (
              <button key={r.id} onClick={() => navigate({ to: "/admin/inbox", search: { t: r.id } })} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                <Icon icon={ch.icon} className="mt-0.5 shrink-0 text-neutral-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate", r.unread ? "font-semibold" : "font-medium")}>{r.guests?.name}</p>
                    <span className="shrink-0 text-xs text-neutral-400">{niceDateTime(r.last_message_at)}</span>
                  </div>
                  <p className={cn("truncate text-sm", r.unread ? "text-neutral-900" : "text-neutral-500")}>{last?.author === "staff" ? "You: " : ""}{last?.body}</p>
                </div>
                {r.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [book, setBook] = useState(false);
  const q = useQuery({
    queryKey: ["inbox", "thread", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, channel, unread, guest_id, guests(id, name, mobile, bookings(id, code, stay_date, slot, status, estimate)), messages(id, author, body, created_at, by_email)")
        .eq("id", id)
        .order("created_at", { referencedTable: "messages" })
        .single();
      if (error) throw new Error(error.message);
      return data as any;
    },
  });
  const replies = useQuery({
    queryKey: ["quick-replies"],
    queryFn: async () => (await supabase.from("quick_replies").select("*").order("sort")).data ?? [],
  });

  useEffect(() => {
    if (q.data?.unread) supabase.from("threads").update({ unread: false }).eq("id", id).then(() => qc.invalidateQueries({ queryKey: ["nav-counts"] }));
  }, [q.data?.unread, id, qc]);

  if (q.isLoading || !q.data) return <Spinner />;
  const th = q.data;
  const ch = CHANNEL[th.channel as keyof typeof CHANNEL];
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
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-neutral-500"><Icon icon={ArrowLeft01Icon} size={16} /> Inbox</button>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{th.guests?.name}</h1>
          <p className="flex items-center gap-1 text-sm text-neutral-500"><Icon icon={ch.icon} size={16} /> {ch.label}{th.guests?.mobile ? ` · ${th.guests.mobile}` : ""}</p>
        </div>
        <Button size="sm" onClick={() => setBook(true)}>Create booking</Button>
      </div>

      {th.guests?.bookings?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {th.guests.bookings.map((b: any) => (
            <a key={b.id} href={`/admin/bookings/${b.id}`} className="shrink-0 rounded-2xl border border-neutral-200 px-3 py-2 text-xs">
              <p className="font-medium">{b.code} · {niceDate(b.stay_date)}</p>
              <p className="text-neutral-500">{SLOT_LABEL[b.slot as Slot]} · {money(b.estimate)}</p>
              <Badge tone={statusTone(b.status)} className="mt-1">{STATUS_LABEL[b.status]}</Badge>
            </a>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {th.messages.map((m: any) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.author === "staff" ? "ml-auto bg-neutral-900 text-white" : "bg-neutral-100")}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={cn("mt-0.5 text-[10px]", m.author === "staff" ? "text-neutral-400" : "text-neutral-500")}>{niceDateTime(m.created_at)}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">Quick replies</p>
        <div className="flex flex-wrap gap-2">
          {replies.data?.map((r: any) => (
            <span key={r.id} className="inline-flex items-center overflow-hidden rounded-full border border-neutral-300 text-sm">
              <button onClick={() => setText(r.body)} className="px-3 py-1">{r.title}</button>
              <button onClick={() => { navigator.clipboard.writeText(r.body); toast.success("Copied — paste it in " + ch.label); }} className="border-l border-neutral-300 px-2 py-1" aria-label="Copy">
                <Icon icon={Copy01Icon} size={14} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="sticky bottom-24 flex gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={live ? "Reply on Messenger…" : `Log what you sent on ${ch.label}…`} className="flex-1 resize-none px-2 py-1 text-sm outline-none" />
        <Button onClick={send} aria-label="Send"><Icon icon={SentIcon} size={18} /></Button>
      </div>
      {!live && <p className="text-xs text-neutral-500">{ch.label} replies are sent from the {ch.label} app; this keeps a copy on the guest.</p>}

      <BookingSheet open={book} onClose={() => setBook(false)} preset={{ source: th.channel === "phone" ? "phone" : th.channel, name: th.guests?.name, mobile: th.guests?.mobile }} />
    </div>
  );
}
