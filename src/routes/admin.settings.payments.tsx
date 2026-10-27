import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { Field, SettingsCard, useSettingsForm } from "@/components/obs/settings-kit";
import { LoadingState } from "@/components/obs/states";
import { useSettings } from "@/lib/data";

export const Route = createFileRoute("/admin/settings/payments")({ component: () => <OwnerOnly><Payments /></OwnerOnly> });

function Payments() {
  const s = useSettings();
  const { f, bind, SaveBar } = useSettingsForm(s.data);
  if (!f) return <LoadingState />;
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Settings" title="Payments" />
      <p className="text-sm text-muted-foreground">Shown to guests after they book online, with the downpayment they owe. Online card payments (Xendit) can be added later.</p>
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard title="GCash">
          <Field id="gn" label="Account name" {...bind("gcash_name")} />
          <Field id="gnum" label="GCash number" {...bind("gcash_number")} />
        </SettingsCard>
        <SettingsCard title="Bank transfer">
          <Field id="bn" label="Bank" {...bind("bank_name")} />
          <Field id="ban" label="Account name" {...bind("bank_account_name")} />
          <Field id="banum" label="Account number" {...bind("bank_account_number")} />
        </SettingsCard>
      </div>
      <SaveBar />
    </div>
  );
}
