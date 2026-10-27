import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slotTimes, useCottages, useCottageTypes, useSettings } from "@/lib/data";
import { manilaToday, php, SLOT_LABEL, SOURCE_LABEL, type Slot } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type BookingPreset = {
  cottage_id?: string;
  date?: string;
  slot?: Slot;
  source?: string;
  name?: string;
  mobile?: string;
  mode?: "booking" | "block";
};

// One dialog for the whole admin, opened from anywhere (the top bar, the +,
// a free half on the board, a chat). A tiny store rather than a context, so
// the shell does not re-render the page every time it opens.
let state: { open: boolean; preset: BookingPreset } = { open: false, preset: {} };
const listeners = new Set<() => void>();
const set = (next: typeof state) => {
  state = next;
  listeners.forEach((l) => l());
};

export function useBookingDialog() {
  return { open: (preset: BookingPreset = {}) => set({ open: true, preset }) };
}

const SOURCES = ["walk_in", "messenger", "whatsapp", "viber", "phone", "facebook"] as const;

/** Malaya's segmented chip row, for the three slots. */
export function SlotChips({ value, onChange, slots = ["day", "night", "h22"] }: { value: Slot; onChange: (s: Slot) => void; slots?: Slot[] }) {
  return (
    <div role="group" className="inline-flex w-full gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1">
      {slots.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors",
            value === s ? "bg-secondary font-medium text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          {SLOT_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function BookingDialog() {
  const { open, preset } = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  const close = () => set({ ...state, open: false });
  const cottages = useCottages().data ?? [];
  const types = useCottageTypes().data ?? [];
  const settings = useSettings().data;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"booking" | "block">("booking");
  const [cottage, setCottage] = useState("");
  const [date, setDate] = useState(manilaToday());
  const [slot, setSlot] = useState<Slot>("day");
  const [adults, setAdults] = useState(4);
  const [kids, setKids] = useState(0);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [source, setSource] = useState("walk_in");
  const [dp, setDp] = useState(0);
  const [dpMethod, setDpMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("Maintenance");
  const [busy, setBusy] = useState(false);
  // One key per opening: a double tap or a retry on weak signal saves once.
  const [clientKey, setClientKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(preset.mode ?? "booking");
    setCottage(preset.cottage_id ?? cottages[0]?.id ?? "");
    setDate(preset.date ?? manilaToday());
    setSlot(preset.slot && preset.slot !== "day_night" ? preset.slot : "day");
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
  const tooMany = type ? adults + kids > type.max_pax : false;

  async function save() {
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
      close();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{mode === "block" ? "Block a slot" : source === "walk_in" ? "Walk-in" : "New reservation"}</DialogTitle>
          <DialogDescription>
            {mode === "block" ? "Closes the slot on the website and the board." : "Saved only if the cottage is free for that slot — two staff can never sell the same one."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div role="group" className="inline-flex gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1">
              {(["booking", "block"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-full px-4 py-1.5 text-[13px]", mode === m ? "bg-secondary font-medium text-primary" : "text-muted-foreground")}>
                  {m === "booking" ? "Booking" : "Block"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cottage</Label>
            <Select value={cottage} onValueChange={setCottage}>
              <SelectTrigger><SelectValue placeholder="Pick a cottage" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectGroup key={t.id}>
                    <SelectLabel>{t.name}</SelectLabel>
                    {cottages.filter((c) => c.type_id === t.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-date">Date</Label>
            <Input id="bd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Slot</Label>
            <SlotChips value={slot} onChange={setSlot} />
            <p className="text-xs text-muted-foreground">{slotTimes(settings, slot)}</p>
          </div>

          {mode === "block" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Maintenance", "Owner use", "Private event", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="bd-ad">Adults</Label><Input id="bd-ad" type="number" inputMode="numeric" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label htmlFor="bd-kids">Kids</Label><Input id="bd-kids" type="number" inputMode="numeric" min={0} value={kids} onChange={(e) => setKids(Number(e.target.value))} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Booking source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {tooMany && <p className="text-sm text-destructive sm:col-span-2">{type?.name} fits up to {type?.max_pax} guests.</p>}
              <div className="space-y-1.5"><Label htmlFor="bd-name">Guest name</Label><Input id="bd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in guest" /></div>
              <div className="space-y-1.5"><Label htmlFor="bd-mob">Mobile (optional)</Label><Input id="bd-mob" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
              <div className="grid gap-3 rounded-xl border border-border/70 p-4 sm:col-span-2 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="bd-dp">Downpayment received</Label><Input id="bd-dp" type="number" inputMode="decimal" min={0} value={dp} onChange={(e) => setDp(Number(e.target.value))} /></div>
                <div className="space-y-1.5">
                  <Label>Paid by</Label>
                  <Select value={dpMethod} onValueChange={setDpMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="gcash">GCash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bd-notes">Notes</Label><Textarea id="bd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </>
          )}
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          {mode === "booking" ? (
            <p className="text-sm text-muted-foreground">Estimate <span className="ml-1 font-display text-lg text-foreground">{est.data !== undefined ? php(est.data) : "…"}</span></p>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={busy || !cottage || tooMany}>{busy ? "Saving…" : mode === "block" ? "Block slot" : "Save booking"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
