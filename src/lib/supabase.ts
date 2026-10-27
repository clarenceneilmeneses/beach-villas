import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// New sb_publishable_ keys are opaque, not JWTs: send them as `apikey` only,
// never as a Bearer token (same wrapper Malaya uses).
const supabaseFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
  headers.set("apikey", key);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(url, key, {
  global: { fetch: supabaseFetch },
  auth: { persistSession: typeof window !== "undefined", autoRefreshToken: true },
});

/** Calls a database function and throws its message as a plain Error. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function signedUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function uploadReceipt(folder: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Every row of a read, past Supabase's 1,000-row cap, 1,000 at a time
 * (Malaya's allRows). `build` returns a fresh, ordered query; end the order
 * with a unique column so the pages don't overlap.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allRows<T>(build: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) return out;
  }
}
