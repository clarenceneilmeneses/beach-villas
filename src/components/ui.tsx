import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/format";

type Tone = "primary" | "outline" | "success" | "danger" | "soft";
const TONE: Record<Tone, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm",
  outline: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  soft: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
};

export function Button({ tone = "primary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm",
        TONE[tone],
        className,
      )}
    />
  );
}

export const Icon = ({ icon, size = 20, className }: { icon: Parameters<typeof HugeiconsIcon>[0]["icon"]; size?: number; className?: string }) => (
  <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={className} />
);

const field = "w-full rounded-xl border border-neutral-300 bg-white px-3 text-[15px] outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(field, "h-11", className)} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(field, "h-11", className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(field, "min-h-20 py-2", className)} />;

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export const Card = ({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) => (
  <div onClick={onClick} className={cn("rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", onClick && "cursor-pointer active:scale-[0.99] transition", className)}>
    {children}
  </div>
);

const BADGE: Record<string, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
};
export const Badge = ({ tone = "neutral", children, className }: { tone?: keyof typeof BADGE; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", BADGE[tone], className)}>{children}</span>
);

export const statusTone = (s: string): keyof typeof BADGE =>
  s === "confirmed" || s === "settled" ? "green" : s === "pending" ? "amber" : s === "checked_in" ? "blue" : s === "cancelled" || s === "no_show" || s === "expired" ? "red" : "neutral";

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("flex rounded-full bg-neutral-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition", value === o.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A bottom sheet on phones, a centred panel on wider screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close">
            <Icon icon={Cancel01Icon} size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center">
    <p className="font-medium">{title}</p>
    {hint && <p className="mt-1 text-sm text-neutral-500">{hint}</p>}
  </div>
);

export const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
  </div>
);

export function SchemaNotice({ error }: { error: unknown }) {
  return (
    <Card className="border-amber-300 bg-amber-50 [overflow-wrap:anywhere]">
      <p className="font-semibold text-amber-900">The database isn't set up yet</p>
      <p className="mt-1 text-sm text-amber-900">
        Open Supabase → SQL Editor, paste <code>supabase/schema.sql</code> and press Run, then reload.
      </p>
      <p className="mt-2 text-xs text-amber-800">{error instanceof Error ? error.message : String(error)}</p>
    </Card>
  );
}

export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div className="rounded-2xl bg-neutral-50 p-3">
    <p className="text-xs text-neutral-500">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    {hint && <p className="text-xs text-neutral-500">{hint}</p>}
  </div>
);
