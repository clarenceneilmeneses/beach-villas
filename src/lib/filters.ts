import { useSyncExternalStore } from "react";
import { addDays, manilaToday, niceDate } from "./format";
import type { Cottage } from "./data";

/**
 * The admin's global filter, as in Malaya's top bar: which cottages, and
 * when. One answer for every screen that has a list or a total, kept per
 * browser so it survives a reload.
 */
export type Preset = "today" | "7d" | "month" | "last_month" | "next30" | "custom";
export type Filters = { scope: string; preset: Preset; from: string; to: string };

export const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "next30", label: "Next 30 days" },
  { value: "custom", label: "Custom" },
];

const KEY = "beach:filters";
const DEFAULT: Filters = { scope: "all", preset: "month", from: "", to: "" };

let state: Filters = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT, ...(JSON.parse(raw) as Filters) };
  } catch {
    /* storage blocked: defaults */
  }
}

export function setFilters(patch: Partial<Filters>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const clearFilters = () => setFilters(DEFAULT);

export function resolveRange(f: Filters) {
  const today = manilaToday();
  const first = `${today.slice(0, 8)}01`;
  let from = first;
  let to = today;
  if (f.preset === "today") from = today;
  if (f.preset === "7d") from = addDays(today, -6);
  if (f.preset === "month") {
    const next = new Date(`${first}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    to = addDays(next.toISOString().slice(0, 10), -1);
  }
  if (f.preset === "last_month") {
    to = addDays(first, -1);
    from = `${to.slice(0, 8)}01`;
  }
  if (f.preset === "next30") {
    from = today;
    to = addDays(today, 29);
  }
  if (f.preset === "custom" && f.from && f.to) {
    from = f.from <= f.to ? f.from : f.to;
    to = f.from <= f.to ? f.to : f.from;
  }
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const short = (d: string) => niceDate(d, { month: "short", day: "numeric" });
  const label = f.preset === "custom" ? `${short(from)} – ${short(to)}` : (PRESETS.find((p) => p.value === f.preset)?.label ?? "");
  return { from, to, days, label, span: from === to ? short(from) : `${short(from)} – ${short(to)}` };
}

export function useFilters() {
  load();
  const f = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => DEFAULT,
  );
  return { filters: f, range: resolveRange(f), active: f.scope !== "all" || f.preset !== DEFAULT.preset };
}

/** The cottages the scope picks, or null for all of them. */
export function scopedCottages(scope: string, cottages: Cottage[]): Set<string> | null {
  if (scope === "all") return null;
  const [kind, id] = scope.split(":");
  return new Set(cottages.filter((c) => (kind === "type" ? c.type_id === id : c.id === id)).map((c) => c.id));
}
