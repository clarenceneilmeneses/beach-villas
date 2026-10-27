import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { slotTimes, useCottages, useCottageTypes, useSettings } from "@/lib/data";
import { manilaToday, money, SLOT_LABEL, SOURCE_LABEL, type Slot } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import { Button, Field, Input, Segmented, Select, Sheet, Textarea } from "./ui";

export type BookingPreset = {
  cottage_id?: string;
  date?: string;
  slot?: Slot;
  source?: string;
  name?: string;
  mobile?: string;
  mode?: "booking" | "block";
};

const SOURCES = ["walk_in", "messenger", "whatsapp", "viber", "phone", "facebook"] as const;

/** Walk-in, chat/phone booking, or a block — all through the same overlap guard. */
export function BookingSheet({ open, onClose, preset }: { open: boolean; onClose: () => void; preset: BookingPreset }) {
  const cottages = useCottages().data ?? [];
  const types = useCottageTypes().data ?? [];
  const settings = useSettings().data;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"booking" | "block">("booking");
  const [cottage, setCottage] = useState("");
  const [date, setDate] = useState(manilaToday());
  const [slot, setSlot] = useState<Exclude<Slot, "day_night">>("day");
  const [adults, setAdults] = useState(4);
  const [kids, setKids] = useState(0);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [source, setSource] = useState<string>("walk_in");
  const [dp, setDp] = useState(0);
  const [dpMethod, setDpMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("Maintenance");
  const [busy, setBusy] = useState(false);
  // One key per opened sheet: a double tap or a retry on weak signal saves once.
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setMode(preset.mode ?? "booking");
    setCottage(preset.cottage_id ?? cottages[0]?.id ?? "");
    setDate(preset.date ?? manilaToday());
    setSlot(preset.slot === "day_night" || !preset.slot ? "day" : preset.slot);
    setSource(preset.source ?? "walk_in");
    setName(preset.name ?? "");
    setMobile(preset.mobile ?? "");
    setAdults(4);
    setKids(0);
    setDp(0);
    setNotes("");
    setClientKey(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const typeId = cottages.find((c) => c.id === cottage)?.type_id;
  const type = types.find((t) => t.id === typeId);
  const est = useQuery({
    queryKey: ["estimate", typeId, date, slot, adults, kids],
    enabled: open && !!typeId && mode === "booking",
    queryFn: () => rpc<number>("price_estimate", { p_type: typeId, p_date: date, p_slot: slot, p_adults: adults, p_children: kids }),
  });

  const grouped = useMemo(
    () => types.map((t) => ({ t, list: cottages.filter((c) => c.type_id === t.id) })),
    [types, cottages],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "block") {
        await rpc("block_slot", { p_cottage: cottage, p_date: date, p_slot: slot, p_reason: reason });
        toast.success("Slot blocked");
      } else {
        const walkInNow = source === "walk_in" && date === manilaToday();
        const r = await rpc<{ id: string; code: string }>("staff_create_booking", {
          p_cottage: cottage, p_date: date, p_slot: slot, p_adults: adults, p_children: kids,
          p_name: name, p_mobile: mobile, p_source: source, p_status: walkInNow ? "checked_in" : "confirmed",
          p_notes: notes, p_client_key: clientKey, p_downpayment: dp, p_dp_method: dpMethod,
        });
        toast.success(`${r.code} saved`, { action: { label: "Open", onClick: () => navigate({ to: "/admin/bookings/$id", params: { id: r.id } }) } });
      }
      qc.invalidateQueries();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tooMany = type ? adults + kids > type.max_pax : false;

  return (
    <Sheet open={open} onClose={onClose} title={mode === "block" ? "Block a slot" : source === "walk_in" ? "Walk-in" : "Add booking"}>
      <form onSubmit={save} className="space-y-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: "booking", label: "Booking" }, { value: "block", label: "Block" }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cottage">
            <Select value={cottage} onChange={(e) => setCottage(e.target.value)}>
              {grouped.map(({ t, list }) => (
                <optgroup key={t.id} label={t.name}>
                  {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div>
          <Segmented value={slot} onChange={setSlot} options={(["day", "night", "h22"] as const).map((s) => ({ value: s, label: SLOT_LABEL[s] }))} />
          <p className="mt-1 text-xs text-neutral-500">{slotTimes(settings, slot)}</p>
        </div>

        {mode === "block" ? (
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {["Maintenance", "Owner use", "Private event", "Other"].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adults"><Input type="number" inputMode="numeric" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} /></Field>
              <Field label="Kids"><Input type="number" inputMode="numeric" min={0} value={kids} onChange={(e) => setKids(Number(e.target.value))} /></Field>
            </div>
            {tooMany && <p className="text-sm text-red-600">{type?.name} fits up to {type?.max_pax}.</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guest name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in guest" /></Field>
              <Field label="Mobile (optional)"><Input inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></Field>
            </div>
            <Field label="Source">
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Downpayment received"><Input type="number" inputMode="decimal" min={0} value={dp} onChange={(e) => setDp(Number(e.target.value))} /></Field>
              <Field label="Paid by">
                <Select value={dpMethod} onChange={(e) => setDpMethod(e.target.value)}>
                  <option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank">Bank</option>
                </Select>
              </Field>
            </div>
            <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-500">Estimate</span>
              <span className="text-lg font-semibold tabular-nums">{est.data !== undefined ? money(est.data) : "…"}</span>
            </div>
          </>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !cottage || tooMany}>
          {busy ? "Saving…" : mode === "block" ? "Block slot" : "Save booking"}
        </Button>
      </form>
    </Sheet>
  );
}
