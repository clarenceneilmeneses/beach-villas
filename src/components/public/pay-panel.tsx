import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ImagePlus, QrCode, X } from "@/components/icons";
import { qrUrl, useSettings } from "@/lib/data";
import { php } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Method = "gcash" | "bank";

/** Malaya's "Pay with" list: one radio card per channel. */
export function MethodPicker({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  const s = useSettings().data;
  const options: { value: Method; title: string; hint: string }[] = [
    { value: "gcash", title: "GCash", hint: "Scan the QR in your GCash app" },
    { value: "bank", title: s?.bank_name ? `${s.bank_name} transfer` : "Bank transfer", hint: "Scan the QR or send to the account" },
  ];
  return (
    <div role="radiogroup" className="grid gap-2.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-4 rounded-2xl border bg-card px-4 py-3.5 text-left transition-colors",
            value === o.value ? "border-primary shadow-level-2" : "border-border/70 hover:bg-secondary/50",
          )}
        >
          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", value === o.value ? "border-primary bg-primary" : "border-border")}>
            {value === o.value && <span className="size-2 rounded-full bg-primary-foreground" />}
          </span>
          <span>
            <span className="block font-medium">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="truncate font-medium tabular-nums">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => { void navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs hover:bg-secondary"
      >
        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** The QR to scan, the account to send to, and the exact amount. */
export function PayDetails({ method, amount }: { method: Method; amount: number }) {
  const s = useSettings().data;
  const qr = qrUrl(method === "gcash" ? s?.gcash_qr_path : s?.bank_qr_path);
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-level-1">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="malaya-eyebrow">Scan to pay</p>
        {qr ? (
          <img src={qr} alt={`${method === "gcash" ? "GCash" : "Bank"} QR code`} className="size-56 rounded-2xl border border-border/70 object-contain p-2" />
        ) : (
          <div className="grid size-56 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground">
            <div className="space-y-1 text-center text-xs"><QrCode className="mx-auto size-8" /><p>QR coming soon — use the account below</p></div>
          </div>
        )}
        <p className="font-display text-3xl">{php(amount)}</p>
        <p className="text-xs text-muted-foreground">Send exactly this amount, then upload the receipt below.</p>
      </div>
      <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
        {method === "gcash" ? (
          <>
            <CopyLine label="GCash number" value={s?.gcash_number ?? ""} />
            <CopyLine label="Account name" value={s?.gcash_name ?? ""} />
          </>
        ) : (
          <>
            <CopyLine label={s?.bank_name || "Bank"} value={s?.bank_account_number ?? ""} />
            <CopyLine label="Account name" value={s?.bank_account_name ?? ""} />
          </>
        )}
        <CopyLine label="Amount" value={String(amount)} />
      </div>
    </div>
  );
}

/** Pick the receipt screenshot; shows it so the guest can see it's the right one. */
export function ReceiptPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return file && preview ? (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card">
      <img src={preview} alt="Your receipt" className="max-h-72 w-full object-contain" />
      <button type="button" onClick={() => onChange(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-card/95 shadow-level-2" aria-label="Remove receipt"><X className="size-4" /></button>
      <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">{file.name}</p>
    </div>
  ) : (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center hover:bg-secondary/40">
      <ImagePlus className="size-7 text-muted-foreground" />
      <span className="font-medium">Upload your receipt</span>
      <span className="text-xs text-muted-foreground">A screenshot of the payment confirmation</span>
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f && f.size > 10e6) return void toast.error("That image is over 10 MB"); onChange(f); }} />
    </label>
  );
}
