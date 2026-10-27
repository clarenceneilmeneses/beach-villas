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

/**
 * One QR Ph code: every bank and e-wallet in the Philippines scans it, so the
 * guest is shown that and nothing else. Stored in settings.gcash_qr_path.
 */
function Payments() {
  const s = useSettings();
  const { f, bind, SaveBar } = useSettingsForm(s.data);
  if (!f) return <LoadingState />;
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Settings" title="Payments" />
      <p className="text-sm text-muted-foreground">Guests scan this at checkout with GCash, Maya or any bank app, pay the downpayment and upload the receipt. Staff verify it before the booking is confirmed.</p>
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard title="QR Ph code" hint="Download it from your bank or GCash/Maya business app (Receive money → QR Ph).">
          <QrUpload path={s.data?.gcash_qr_path} />
          <Field id="qrname" label="Account name shown to guests" {...bind("gcash_name")} />
        </SettingsCard>
      </div>
      <SaveBar />
    </div>
  );
}

function QrUpload({ path }: { path?: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const url = qrUrl(path);
  async function upload(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const next = `qrph-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("payment-qr").upload(next, file);
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("settings").update({ gcash_qr_path: next }).eq("id", 1);
      if (error) throw new Error(error.message);
      if (path) void supabase.storage.from("payment-qr").remove([path]);
      toast.success("QR Ph code updated");
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
        <img src={url} alt="QR Ph code" className="size-32 rounded-2xl border border-border/70 object-contain p-1.5" />
      ) : (
        <div className="grid size-32 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"><QrCode className="size-8" /></div>
      )}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{url ? "Shown to guests at checkout and in My bookings." : "Not uploaded — guests are told to message you for payment details."}</p>
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
