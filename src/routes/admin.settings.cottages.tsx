import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { Field, SettingsCard } from "@/components/obs/settings-kit";
import { LoadingState } from "@/components/obs/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCottages, useCottageTypes, type CottageType } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/settings/cottages")({ component: () => <OwnerOnly><Cottages /></OwnerOnly> });

function Cottages() {
  const types = useCottageTypes();
  const cottages = useCottages().data ?? [];
  if (!types.data) return <LoadingState />;
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`${types.data.length} types · ${cottages.length} cottages`} title="Cottages & rates" />
      <p className="text-sm text-muted-foreground">Rates, pax and the downpayment are per cottage type. Fri–Sat adds the weekend amount; the estimate adds extra heads and the entrance fee.</p>
      <div className="grid gap-6 xl:grid-cols-2">
        {types.data.map((t) => <TypeCard key={t.id} t={t} units={cottages.filter((c) => c.type_id === t.id).map((c) => c.name)} />)}
      </div>
    </div>
  );
}

function TypeCard({ t, units }: { t: CottageType; units: string[] }) {
  const qc = useQueryClient();
  const [f, setF] = useState(t);
  const [busy, setBusy] = useState(false);
  const num = (k: keyof CottageType, label: string) => (
    <Field id={`${t.id}-${k}`} label={label} type="number" inputMode="decimal" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
  );
  async function save() {
    setBusy(true);
    const { id, ...rest } = f;
    const { error } = await supabase.from("cottage_types").update(rest).eq("id", id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`${f.name} saved`);
    qc.invalidateQueries();
  }
  return (
    <SettingsCard title={t.name} hint={`${units.length} cottages`}>
      <div className="flex flex-wrap gap-1.5">{units.map((u) => <Badge key={u} variant="secondary" className="rounded-full">{u}</Badge>)}</div>
      <Field id={`${t.id}-name`} label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field id={`${t.id}-desc`} label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div>
        <p className="malaya-eyebrow mb-2">Rates</p>
        <div className="grid grid-cols-3 gap-3">
          {num("rate_day", "Day tour ₱")}
          {num("rate_night", "Overnight ₱")}
          {num("rate_h22", "22 hours ₱")}
          {num("weekend_surcharge", "Fri–Sat + ₱")}
          {num("downpayment", "Downpayment ₱")}
          {num("extra_head_fee", "Extra head ₱")}
        </div>
      </div>
      <div>
        <p className="malaya-eyebrow mb-2">Pax</p>
        <div className="grid grid-cols-3 gap-3">
          {num("pax_included", "Heads included")}
          {num("max_pax", "Max heads")}
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}>{busy ? "Saving…" : `Save ${f.name}`}</Button></div>
    </SettingsCard>
  );
}
