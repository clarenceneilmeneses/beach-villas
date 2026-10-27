import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "@/components/icons";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { SettingsCard } from "@/components/obs/settings-kit";
import { LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/settings/quick-replies")({ component: () => <OwnerOnly><QuickReplies /></OwnerOnly> });

type Reply = { id: string; title: string; body: string; sort: number };

function QuickReplies() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["quick-replies"], queryFn: async () => ((await supabase.from("quick_replies").select("*").order("sort")).data ?? []) as Reply[] });
  if (!q.data) return <LoadingState />;
  async function add() {
    const { error } = await supabase.from("quick_replies").insert({ title: "New reply", body: "", sort: (q.data?.length ?? 0) + 1 });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["quick-replies"] });
  }
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Settings" title="Quick replies" action={<Button onClick={add}><Plus className="size-4" /> Add reply</Button>} />
      <p className="text-sm text-muted-foreground">Saved answers for the Inbox. In Messenger they send in one tap; for WhatsApp and Viber staff copy and paste them. Tagalog is fine.</p>
      <div className="grid gap-6 xl:grid-cols-2">{q.data.map((r) => <ReplyCard key={r.id} r={r} />)}</div>
    </div>
  );
}

function ReplyCard({ r }: { r: Reply }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(r.title);
  const [body, setBody] = useState(r.body);
  async function save() {
    const { error } = await supabase.from("quick_replies").update({ title, body }).eq("id", r.id);
    if (error) return void toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["quick-replies"] });
  }
  async function remove() {
    const { error } = await supabase.from("quick_replies").delete().eq("id", r.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["quick-replies"] });
  }
  return (
    <SettingsCard title={r.title}>
      <div className="space-y-1.5"><Label htmlFor={`${r.id}-t`}>Title</Label><Input id={`${r.id}-t`} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor={`${r.id}-b`}>Message</Label><Textarea id={`${r.id}-b`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="flex justify-between">
        <Button variant="destructive-outline" size="sm" onClick={remove}><Trash2 className="size-4" /> Delete</Button>
        <Button size="sm" onClick={save}>Save</Button>
      </div>
    </SettingsCard>
  );
}
