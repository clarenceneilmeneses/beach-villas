import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rpc, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AuthPanel({ onDone, hint }: { onDone?: () => void; hint?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } });
    if (error) {
      setBusy(false);
      return void toast.error(error.message);
    }
    if (mode === "up" && !data.session) {
      setBusy(false);
      return void toast.success("Check your email to confirm your account, then sign in.");
    }
    // Staff use the same sign-in as guests; wherever they sign in, they land on the admin.
    if (mode === "in" && (await rpc<boolean>("is_staff", {}).catch(() => false))) return void navigate({ to: "/admin" });
    setBusy(false);
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="inline-flex w-full gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-level-1">
        {(["in", "up"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-full py-1.5 text-sm", mode === m ? "bg-secondary font-medium text-primary" : "text-muted-foreground")}>
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="space-y-1.5"><Label htmlFor="au-e">Email</Label><Input id="au-e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <div className="space-y-1.5"><Label htmlFor="au-p">Password</Label><Input id="au-p" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
      <Button type="submit" className="h-11 w-full rounded-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</Button>
    </form>
  );
}
