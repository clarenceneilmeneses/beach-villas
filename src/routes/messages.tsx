import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "@/components/icons";
import { useNavPillAway } from "@/components/nav-pill";
import { PublicShell } from "@/components/public/chrome";
import { AuthPanel } from "@/components/public/auth-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { niceDateTime } from "@/lib/format";
import { rpc, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({ component: Messages });

type Msg = { id: string; author: "guest" | "staff"; body: string; created_at: string };

/** The guest's one conversation with the resort, answered from the admin Inbox. */
function Messages() {
  const { session, ready } = useAuth();
  const settings = useSettings().data;
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["my-thread", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, messages(id, author, body, created_at), guests!inner(user_id)")
        .eq("guests.user_id", session!.user.id)
        .order("created_at", { referencedTable: "messages" })
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.messages ?? []) as Msg[];
    },
  });

  // Staff replies arrive while the page is open.
  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel("guest-thread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["my-thread"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session, qc]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [q.data?.length]);
  useNavPillAway(!!session);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await rpc("guest_send_message", { p_body: text.trim() });
      setText("");
      qc.invalidateQueries({ queryKey: ["my-thread"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell hideFooter>
      <div className="mx-auto flex max-w-2xl flex-col px-4 pb-32 pt-6 sm:px-8 md:pb-10">
        <h1 className="site-display text-3xl">Messages</h1>
        <p className="text-sm text-muted-foreground">Ask {settings?.resort_name ?? "us"} anything — rates, slots, directions. We reply here.</p>

        {!ready ? <Skeleton className="mt-6 h-64 rounded-3xl" /> : !session ? (
          <Card className="mt-6 rounded-3xl border-border/70 shadow-level-2"><CardContent className="p-6"><AuthPanel hint="Sign in to message the resort." /></CardContent></Card>
        ) : (
          <Card className="mt-6 flex min-h-[60dvh] flex-col rounded-3xl border-border/70 shadow-level-2">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
              {q.isLoading && <Skeleton className="h-16 w-2/3 rounded-2xl" />}
              {!q.isLoading && !q.data?.length && (
                <p className="py-16 text-center text-sm text-muted-foreground">No messages yet. Say hi — the front desk will answer here.</p>
              )}
              {q.data?.map((m) => (
                <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", m.author === "guest" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary")}>
                  {m.author === "staff" && <p className="mb-0.5 text-[11px] font-semibold">{settings?.resort_name}</p>}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("mt-0.5 text-[10px]", m.author === "guest" ? "text-primary-foreground/60" : "text-muted-foreground")}>{niceDateTime(m.created_at)}</p>
                </div>
              ))}
              <div ref={end} />
            </div>
            <div className="flex items-end gap-2 border-t border-border/70 p-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                rows={1}
                placeholder="Write a message…"
                className="min-h-[44px] resize-none"
              />
              <Button onClick={send} disabled={busy || !text.trim()} size="icon" className="size-11 shrink-0 rounded-full" aria-label="Send"><Send className="size-4" /></Button>
            </div>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}
