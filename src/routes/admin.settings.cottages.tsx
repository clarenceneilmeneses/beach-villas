import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Star, Trash2 } from "@/components/icons";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { Field, SettingsCard } from "@/components/obs/settings-kit";
import { LoadingState } from "@/components/obs/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCottages, useCottageTypes, type CottageType } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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
    // Photos save on their own (Photos below); never send this card's stale copy.
    const { id, photos: _photos, photo_url: _cover, ...rest } = f;
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
      {"photos" in t && <Photos t={t} />}
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

const BUCKET = "cottage-photos";

/** Phone photos are big: shrink to 1600px WebP in the browser before upload. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("Could not read that photo"))), "image/webp", 0.8));
}

/** The type's photos: the first is the cover on the site. Changes save at once. */
function Photos({ t }: { t: CottageType }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const photos = t.photos ?? [];
  async function put(next: string[]) {
    const { error } = await supabase.from("cottage_types").update({ photos: next, photo_url: next[0] ?? "" }).eq("id", t.id);
    if (error) throw new Error(error.message);
    await qc.invalidateQueries({ queryKey: ["cottage-types"] });
  }
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added: string[] = [];
      for (const [i, file] of [...files].entries()) {
        const path = `${t.id}/${Date.now()}-${i}.webp`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, await shrink(file), { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw new Error(error.message);
        added.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      await put([...photos, ...added]);
      toast.success(`${added.length} photo${added.length === 1 ? "" : "s"} added`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(next: string[], removed?: string) {
    setBusy(true);
    try {
      await put(next);
      const path = removed?.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="malaya-eyebrow mb-2">Photos · the first is the cover</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
            <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-semibold shadow-level-1">Cover</span>}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
              {i > 0 && (
                <button type="button" disabled={busy} onClick={() => change([src, ...photos.filter((p) => p !== src)])} className="grid size-7 place-items-center rounded-full bg-card/95 shadow-level-1" aria-label="Make cover" title="Make cover">
                  <Star className="size-3.5" />
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => change(photos.filter((p) => p !== src), src)} className="grid size-7 place-items-center rounded-full bg-card/95 text-destructive shadow-level-1" aria-label="Remove photo" title="Remove photo">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        <label className={cn("grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground hover:bg-secondary", busy && "pointer-events-none opacity-60")}>
          <span className="grid justify-items-center gap-1"><ImagePlus className="size-5" />{busy ? "Saving…" : "Add photos"}</span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
