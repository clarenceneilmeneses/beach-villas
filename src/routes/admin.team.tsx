import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "@/components/icons";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { ErrorState, LoadingState } from "@/components/obs/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaff } from "@/lib/auth";
import { niceDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/team")({ component: () => <OwnerOnly><Team /></OwnerOnly> });

function Team() {
  const me = useStaff().data;
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const staff = useQuery({ queryKey: ["staff"], queryFn: async () => { const r = await supabase.from("staff").select("*").order("created_at"); if (r.error) throw new Error(r.error.message); return r.data as any[]; } });
  const log = useQuery({ queryKey: ["activity"], queryFn: async () => (await supabase.from("activity_log").select("*, bookings(id, code)").order("at", { ascending: false }).limit(50)).data ?? [] });
  if (staff.error) return <ErrorState error={staff.error} onRetry={() => staff.refetch()} />;
  if (staff.isLoading) return <LoadingState />;

  async function toggle(email: string, active: boolean) {
    const { error } = await supabase.from("staff").update({ active }).eq("email", email);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff"] });
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading eyebrow={`${staff.data?.length ?? 0} people`} title="Team" action={<Button onClick={() => setAdding(true)}><UserPlus className="size-4" /> Add member</Button>} />
        <Card className="border-border/70 bg-surface shadow-level-2">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.data?.map((s) => (
                  <TableRow key={s.email}>
                    <TableCell>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{s.email}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{s.email}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full">{s.role === "owner" ? "Owner" : "Staff"}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.active ? "rounded-full border-success/30 bg-success/12 text-success" : "rounded-full text-muted-foreground"}>{s.active ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.email !== me?.email && (
                        <Button size="sm" variant={s.active ? "destructive-outline" : "outline"} onClick={() => toggle(s.email, !s.active)}>{s.active ? "Disable" : "Enable"}</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="mt-3 text-xs text-muted-foreground">Owner sees everything. Staff work the front desk — Dashboard, Inbox, Bookings, Calendar — and can't open Finance, Team or Settings.</p>
      </section>

      <section>
        <SectionHeading eyebrow="Last 50" title="Activity" />
        <Card className="border-border/70 bg-surface shadow-level-1">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(log.data as any[] | undefined)?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">{niceDateTime(l.at)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">{l.actor || "system"}</TableCell>
                    <TableCell className="text-sm">
                      {l.action}
                      {l.bookings && <> · <Link to="/admin/bookings/$id" params={{ id: l.bookings.id }} className="link-action">{l.bookings.code}</Link></>}
                      {l.detail && <span className="text-muted-foreground"> · {l.detail}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
      {adding && <AddMember onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddMember({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", email: "", role: "staff" });
  async function save() {
    const { error } = await supabase.from("staff").insert({ ...f, email: f.email.toLowerCase().trim() });
    if (error) return void toast.error(error.message);
    toast.success(`${f.name} added — they sign in at /login with ${f.email}`);
    qc.invalidateQueries({ queryKey: ["staff"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add a team member</DialogTitle>
          <DialogDescription>They create an account at the sign-in page with this email; the role decides what they see.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label htmlFor="tm-n">Name</Label><Input id="tm-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="tm-e">Email</Label><Input id="tm-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="owner">Owner</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.name || !f.email} onClick={save}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
