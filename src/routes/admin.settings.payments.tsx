import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, QrCode } from "@/components/icons";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { Field, SettingsCard, useSettingsForm } from "@/components/obs/settings-kit";
import { LoadingState } from "@/components/obs/states";
import { Button } from "@/components/ui/button";
import { qrUrl, useSettings } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/settings/payments")({ component: () => <OwnerOnly><Payments /></OwnerOnly> });

function Payments() {
  const s = useSettings();
  const { f, bind, SaveBar } = useSettingsForm(s.data);
  if (!f) return <LoadingState />;
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Settings" title="Payments" />
      <p className="text-sm text-muted-foreground">Guests scan the QR at checkout, pay the downpayment and upload the receipt. Card payments (Xendit) can be added later.</p>
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard title="GCash">
          <QrUpload column="gcash_qr_path" path={s.data?.gcash_qr_path} label="GCash QR" />
          <Field id="gn" label="Account name" {...bind("gcash_name")} />
          <Field id="gnum" label="GCash number" {...bind("gcash_number")} />
        </SettingsCard>
        <SettingsCard title="Bank transfer">
          <QrUpload column="bank_qr_path" path={s.data?.bank_qr_path} label="Bank QR (InstaPay)" />
          <Field id="bn" label="Bank" {...bind("bank_name")} />
          <Field id="ban" label="Account name" {...bind("bank_account_name")} />
          <Field id="banum" label="Account number" {...bind("bank_account_number")} />
        </SettingsCard>
      </div>
      <SaveBar />
    </div>
  );
}

/** Uploads the QR image to the public payment-qr bucket and saves its path straight away. */
function QrUpload({ column, path, label }: { column: "gcash_qr_path" | "bank_qr_path"; path?: string | null; label: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const url = qrUrl(path);
  async function upload(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const next = `${column.replace("_qr_path", "")}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("payment-qr").upload(next, file);
      if (up.error) throw new Error(up.error.message.includes("Bucket not found") ? "Run supabase/migrations/002_guest_chat_and_qr.sql first" : up.error.message);
      const { error } = await supabase.from("settings").update({ [column]: next }).eq("id", 1);
      if (error) throw new Error(error.message.includes("column") ? "Run supabase/migrations/002_guest_chat_and_qr.sql first" : error.message);
      if (path) void supabase.storage.from("payment-qr").remove([path]);
      toast.success(`${label} updated`);
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-4">
      {url ? (
        <img src={url} alt={label} className="size-28 rounded-2xl border border-border/70 object-contain p-1.5" />
      ) : (
        <div className="grid size-28 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"><QrCode className="size-8" /></div>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{url ? "Shown to guests at checkout." : "Not uploaded — guests only see the account number."}</p>
        <Button variant="outline" size="sm" asChild disabled={busy}>
          <label className="cursor-pointer">
            <ImagePlus className="size-4" /> {busy ? "Uploading…" : url ? "Replace" : "Upload QR"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
          </label>
        </Button>
      </div>
    </div>
  );
}
