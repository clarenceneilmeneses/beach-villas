import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Slot } from "./format";

export type Settings = {
  resort_name: string;
  tagline: string;
  address: string;
  day_start: string;
  day_end: string;
  night_start: string;
  night_end: string;
  h22_start: string;
  h22_end: string;
  hold_hours: number;
  entrance_adult: number;
  entrance_child: number;
  gcash_name: string;
  gcash_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  messenger_url: string;
  whatsapp_number: string;
  viber_number: string;
  facebook_url: string;
};

export type CottageType = {
  id: string;
  name: string;
  description: string;
  photo_url: string;
  pax_included: number;
  max_pax: number;
  rate_day: number;
  rate_night: number;
  rate_h22: number;
  weekend_surcharge: number;
  extra_head_fee: number;
  downpayment: number;
  sort: number;
};

export type Cottage = { id: string; name: string; type_id: string; sort: number };

export type Booking = {
  id: string;
  code: string;
  cottage_id: string;
  guest_id: string | null;
  user_id: string | null;
  stay_date: string;
  slot: Slot;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  pax_adults: number;
  pax_children: number;
  estimate: number;
  final_amount: number | null;
  hold_until: string | null;
  block_reason: string | null;
  notes: string;
  checked_out_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  booking_id: string;
  kind: "downpayment" | "final" | "refund";
  method: "cash" | "gcash" | "bank";
  amount: number;
  status: "submitted" | "verified" | "rejected";
  receipt_path: string | null;
  reference: string;
  created_by: string | null;
  created_at: string;
  edited: boolean;
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw new Error(error.message);
      return data as Settings | null;
    },
    staleTime: 60_000,
  });
}

export function useCottageTypes() {
  return useQuery({
    queryKey: ["cottage-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cottage_types").select("*").eq("active", true).order("sort");
      if (error) throw new Error(error.message);
      return (data ?? []) as CottageType[];
    },
    staleTime: 60_000,
  });
}

export function useCottages() {
  return useQuery({
    queryKey: ["cottages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cottages").select("id,name,type_id,sort").eq("active", true).order("sort");
      if (error) throw new Error(error.message);
      return (data ?? []) as Cottage[];
    },
    staleTime: 60_000,
  });
}

/** True when the schema has not been run on this Supabase project yet. */
export const isMissingSchema = (e: unknown) =>
  e instanceof Error && /relation .* does not exist|Could not find the table|schema cache/i.test(e.message);

export const slotTimes = (s: Settings | null | undefined, slot: Slot) => {
  if (!s) return "";
  const t = (x: string) => {
    const [h, m] = x.split(":").map(Number);
    const hh = ((h! + 11) % 12) + 1;
    return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h! < 12 ? "AM" : "PM"}`;
  };
  if (slot === "day") return `${t(s.day_start)} – ${t(s.day_end)}`;
  if (slot === "night") return `${t(s.night_start)} – ${t(s.night_end)}`;
  if (slot === "h22") return `${t(s.h22_start)} – ${t(s.h22_end)} next day`;
  return `${t(s.day_start)} – ${t(s.night_end)} next day`;
};
