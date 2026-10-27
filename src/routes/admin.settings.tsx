import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Empty, Field, Input, Spinner } from "@/components/ui";
import { useStaff } from "@/lib/auth";
import { useCottageTypes, useSettings, type CottageType, type Settings } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const me = useStaff().data;
  const settings = useSettings();
  const types = useCottageTypes();
  if (me?.role !== "owner") return <Empty title="Settings are for the owner" />;
  if (!settings.data || !types.data) return <Spinner />;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ResortForm s={settings.data} />
      <h2 className="font-semibold">Cottage types · rates & pax</h2>
      {types.data.map((t) => <TypeForm key={t.id} t={t} />)}
    </div>
  );
}

function ResortForm({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const [f, setF] = useState(s);
  useEffect(() => setF(s), [s]);
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("settings").update(f).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }
  const time = (k: keyof Settings, label: string) => <Field label={label}><Input type="time" value={String(f[k]).slice(0, 5)} onChange={set(k)} /></Field>;
  return (
    <Card>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Resort name" className="col-span-2"><Input value={f.resort_name} onChange={set("resort_name")} /></Field>
          <Field label="Tagline" className="col-span-2"><Input value={f.tagline} onChange={set("tagline")} /></Field>
          <Field label="Address" className="col-span-2"><Input value={f.address} onChange={set("address")} /></Field>
        </div>
        <p className="text-sm font-semibold">Slot times</p>
        <div className="grid grid-cols-2 gap-3">
          {time("day_start", "Day tour from")}{time("day_end", "Day tour until")}
          {time("night_start", "Overnight from")}{time("night_end", "Overnight until (next day)")}
          {time("h22_start", "22 hours from")}{time("h22_end", "22 hours until (next day)")}
        </div>
        <p className="text-sm font-semibold">Entrance & holds</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Adult"><Input type="number" value={f.entrance_adult} onChange={set("entrance_adult")} /></Field>
          <Field label="Child"><Input type="number" value={f.entrance_child} onChange={set("entrance_child")} /></Field>
          <Field label="Hold (hours)"><Input type="number" value={f.hold_hours} onChange={set("hold_hours")} /></Field>
        </div>
        <p className="text-sm font-semibold">Payment details shown to guests</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GCash name"><Input value={f.gcash_name} onChange={set("gcash_name")} /></Field>
          <Field label="GCash number"><Input value={f.gcash_number} onChange={set("gcash_number")} /></Field>
          <Field label="Bank"><Input value={f.bank_name} onChange={set("bank_name")} /></Field>
          <Field label="Account name"><Input value={f.bank_account_name} onChange={set("bank_account_name")} /></Field>
          <Field label="Account number" className="col-span-2"><Input value={f.bank_account_number} onChange={set("bank_account_number")} /></Field>
        </div>
        <p className="text-sm font-semibold">Chat links</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Messenger link" className="col-span-2"><Input value={f.messenger_url} onChange={set("messenger_url")} placeholder="https://m.me/yourpage" /></Field>
          <Field label="WhatsApp number"><Input value={f.whatsapp_number} onChange={set("whatsapp_number")} /></Field>
          <Field label="Viber number"><Input value={f.viber_number} onChange={set("viber_number")} /></Field>
          <Field label="Facebook page" className="col-span-2"><Input value={f.facebook_url} onChange={set("facebook_url")} /></Field>
        </div>
        <Button type="submit" className="w-full">Save resort settings</Button>
      </form>
    </Card>
  );
}

function TypeForm({ t }: { t: CottageType }) {
  const qc = useQueryClient();
  const [f, setF] = useState(t);
  const num = (k: keyof CottageType, label: string) => (
    <Field label={label}><Input type="number" inputMode="decimal" value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></Field>
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { id, ...rest } = f;
    const { error } = await supabase.from("cottage_types").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${f.name} saved`);
    qc.invalidateQueries();
  }
  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          {num("rate_day", "Day tour ₱")}{num("rate_night", "Overnight ₱")}{num("rate_h22", "22 hours ₱")}
          {num("weekend_surcharge", "Fri–Sat + ₱")}{num("downpayment", "Downpayment ₱")}{num("extra_head_fee", "Extra head ₱")}
          {num("pax_included", "Heads included")}{num("max_pax", "Max heads")}
        </div>
        <Button type="submit" tone="outline" className="w-full">Save {f.name}</Button>
      </form>
    </Card>
  );
}
