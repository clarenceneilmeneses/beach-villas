import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ImagePlus, QrCode, X } from "@/components/icons";
import { qrUrl, useSettings } from "@/lib/data";
import { php } from "@/lib/format";
import { rpc } from "@/lib/supabase";

/**
 * One QR Ph code. Every Philippine bank and e-wallet scans it (GCash, Maya,
 * BDO, BPI…), so there is no "pay with" choice to make — just the code, the
 * amount, and the receipt.
 */
export function PayDetails({ amount }: { amount: number }) {
  const s = useSettings().data;
  const qr = qrUrl(s?.gcash_qr_path);
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 text-center shadow-level-1">
      <p className="malaya-eyebrow">Scan to pay · QR Ph</p>
      <div className="mt-3 flex justify-center">
        {qr ? (
          <img src={qr} alt="QR Ph code" className="size-60 rounded-2xl border border-border/70 object-contain p-2" />
        ) : (
          <div className="grid size-60 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground">
            <div className="space-y-1 text-xs"><QrCode className="mx-auto size-8" /><p>The resort hasn't added its QR yet.<br />Message us for the payment details.</p></div>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Works with GCash, Maya and any bank app.</p>
      {s?.gcash_name && <p className="mt-1 text-sm">Paying <span className="font-medium">{s.gcash_name}</span></p>}
      <div className="mt-4 flex items-center justify-center gap-3">
        <p className="font-display text-3xl tabular-nums">{php(amount)}</p>
        <button
          type="button"
          onClick={() => { void navigator.clipboard.writeText(String(amount)); setDone(true); setTimeout(() => setDone(false), 1500); }}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs hover:bg-secondary"
        >
          {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? "Copied" : "Copy amount"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Send exactly this amount, then upload the receipt below.</p>
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

/**
 * Sends the receipt as a QR Ph payment. Until migrations/004 is run the
 * database only knows cash, gcash and bank, so it falls back to "bank".
 */
export async function submitReceipt(booking: string, path: string, amount: number) {
  try {
    await rpc("submit_receipt", { p_booking: booking, p_path: path, p_method: "qrph", p_amount: amount, p_reference: "" });
  } catch (e) {
    if (!/method_check|check constraint/i.test((e as Error).message)) throw e;
    await rpc("submit_receipt", { p_booking: booking, p_path: path, p_method: "bank", p_amount: amount, p_reference: "" });
  }
}
