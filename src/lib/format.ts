export type Slot = "day" | "night" | "h22" | "day_night";

export const SLOT_LABEL: Record<Slot, string> = {
  day: "Day tour",
  night: "Overnight",
  h22: "22 hours",
  day_night: "Day + overnight",
};

export const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  walk_in: "Walk-in",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  viber: "Viber",
  phone: "Phone",
  facebook: "Facebook",
  block: "Block",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending downpayment",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  settled: "Settled",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Hold expired",
  blocked: "Blocked",
};

export const METHOD_LABEL: Record<string, string> = { cash: "Cash", gcash: "GCash", bank: "Bank" };

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
export const money = (n: number | string | null | undefined) => peso.format(Number(n ?? 0));

/** Today's date in Manila as YYYY-MM-DD. */
export function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function niceDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { ...opts, timeZone: "UTC" });
}

export function niceTime(ts: string | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

export function niceDateTime(ts: string | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

/** Start of a Manila day as an ISO timestamp, for filtering created_at. */
export const manilaDayStart = (iso: string) => `${iso}T00:00:00+08:00`;

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const halvesOf = (slot: Slot) => (slot === "h22" || slot === "day_night" ? 2 : 1);

export function signedPct(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/** Peso, Malaya's name for it. */
export const php = money;
