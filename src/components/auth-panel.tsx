import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input, Segmented } from "./ui";

export function AuthPanel({ onDone, hint }: { onDone?: () => void; hint?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (mode === "up" && !data.session) return toast.success("Check your email to confirm your account, then sign in.");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented value={mode} onChange={setMode} options={[{ value: "in", label: "Sign in" }, { value: "up", label: "Create account" }]} />
      {hint && <p className="text-sm text-neutral-500">{hint}</p>}
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <Field label="Password"><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</Button>
      <p className="text-center text-xs text-neutral-400">Preview logins: guest@beach.test · staff@beach.test · owner@beach.test — password beach1234</p>
    </form>
  );
}
