import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { Badge, Button, Card, Empty, Field, Icon, Input, Select, Spinner } from "@/components/ui";
import { useStaff } from "@/lib/auth";
import { niceDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/team")({ component: Team });

function Team() {
  const me = useStaff().data;
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff"], queryFn: async () => (await supabase.from("staff").select("*").order("created_at")).data ?? [] });
  const log = useQuery({ queryKey: ["activity"], queryFn: async () => (await supabase.from("activity_log").select("*, bookings(code)").order("at", { ascending: false }).limit(50)).data ?? [] });
  const [form, setForm] = useState({ email: "", name: "", role: "staff" });

  if (me?.role !== "owner") return <Empty title="Team is for the owner" />;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("staff").insert({ ...form, email: form.email.toLowerCase().trim() });
    if (error) return toast.error(error.message);
    toast.success(`${form.name} added. They sign in at /login with ${form.email}.`);
    setForm({ email: "", name: "", role: "staff" });
    qc.invalidateQueries({ queryKey: ["staff"] });
  }
  async function toggle(email: string, active: boolean) {
    const { error } = await supabase.from("staff").update({ active }).eq("email", email);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Team</h1>
        <Link to="/admin/settings" className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium"><Icon icon={Settings01Icon} size={16} /> Settings</Link>
      </div>

      {staff.isLoading ? <Spinner /> : (
        <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {staff.data?.map((s: any) => (
            <div key={s.email} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{s.name} <Badge tone={s.role === "owner" ? "blue" : "neutral"}>{s.role === "owner" ? "Owner" : "Staff"}</Badge></p>
                <p className="truncate text-sm text-neutral-500">{s.email}</p>
              </div>
              {s.email !== me.email && (
                <Button size="sm" tone={s.active ? "danger" : "outline"} onClick={() => toggle(s.email, !s.active)}>{s.active ? "Disable" : "Enable"}</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Add a team member</h2>
        <form onSubmit={add} className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="owner">Owner</option></Select></Field>
          <Field label="Email" className="col-span-2"><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2">Add</Button>
        </form>
      </Card>

      <section>
        <h2 className="mb-2 font-semibold">Recent activity</h2>
        <ul className="space-y-1 text-sm text-neutral-500">
          {log.data?.map((l: any) => (
            <li key={l.id}>{niceDateTime(l.at)} · <span className="text-neutral-800">{l.actor || "system"}</span> · {l.action}{l.bookings?.code ? ` · ${l.bookings.code}` : ""}{l.detail ? ` · ${l.detail}` : ""}</li>
          ))}
          {!log.data?.length && <li>No activity yet.</li>}
        </ul>
      </section>
    </div>
  );
}
