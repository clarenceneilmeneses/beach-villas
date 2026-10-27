import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/obs/app-shell";
import { SectionHeading } from "@/components/obs/cards";
import { Field, SettingsCard, useSettingsForm } from "@/components/obs/settings-kit";
import { LoadingState } from "@/components/obs/states";
import { useSettings } from "@/lib/data";

export const Route = createFileRoute("/admin/settings/")({ component: () => <OwnerOnly><General /></OwnerOnly> });

function General() {
  const s = useSettings();
  const { f, bind, SaveBar } = useSettingsForm(s.data);
  if (!f) return <LoadingState />;
  const time = (k: Parameters<typeof bind>[0], label: string) => {
    const b = bind(k);
    return <Field id={k} label={label} type="time" value={b.value.slice(0, 5)} onChange={b.onChange} />;
  };
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Settings" title="General" />
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard title="The resort" hint="Shown on the guest site and in the admin.">
          <Field id="rn" label="Resort name" {...bind("resort_name")} />
          <Field id="tl" label="Tagline" {...bind("tagline")} />
          <Field id="ad" label="Address" {...bind("address")} />
        </SettingsCard>
        <SettingsCard title="Slot times" hint="An overnight or 22-hour stay ends the next day.">
          <div className="grid grid-cols-2 gap-4">
            {time("day_start", "Day tour from")}
            {time("day_end", "Day tour until")}
            {time("night_start", "Overnight from")}
            {time("night_end", "Overnight until")}
            {time("h22_start", "22 hours from")}
            {time("h22_end", "22 hours until")}
          </div>
        </SettingsCard>
        <SettingsCard title="Entrance and holds" hint="Entrance is added per head on top of the cottage rate. An online booking is held this long for its downpayment.">
          <div className="grid grid-cols-3 gap-4">
            <Field id="ea" label="Adult ₱" type="number" {...bind("entrance_adult")} />
            <Field id="ec" label="Child ₱" type="number" {...bind("entrance_child")} />
            <Field id="hh" label="Hold (hours)" type="number" {...bind("hold_hours")} />
          </div>
        </SettingsCard>
        <SettingsCard title="Chat links" hint="The guest site's Message us buttons.">
          <Field id="mu" label="Messenger link" placeholder="https://m.me/yourpage" {...bind("messenger_url")} />
          <div className="grid grid-cols-2 gap-4">
            <Field id="wa" label="WhatsApp number" {...bind("whatsapp_number")} />
            <Field id="vb" label="Viber number" {...bind("viber_number")} />
          </div>
          <Field id="fb" label="Facebook page" {...bind("facebook_url")} />
        </SettingsCard>
      </div>
      <SaveBar />
    </div>
  );
}
