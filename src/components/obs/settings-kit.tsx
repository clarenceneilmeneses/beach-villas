import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** A settings section: a titled card, as Malaya's Settings tabs lay them out. */
export function SettingsCard({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/70 bg-surface shadow-level-2", className)}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-lg">{title}</h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function Field({ label, id, className, ...input }: { label: string; id: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}

/** Edits the one settings row; the page passes which fields it shows. */
export function useSettingsForm(s: Settings | null | undefined) {
  const qc = useQueryClient();
  const [f, setF] = useState<Settings | null>(s ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setF(s ?? null);
  }, [s]);
  const bind = (k: keyof Settings) => ({
    value: f ? String(f[k] ?? "") : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => f && setF({ ...f, [k]: e.target.value }),
  });
  const save = async () => {
    if (!f) return;
    setBusy(true);
    // A cleared map pin is null, not "".
    const row = { ...f, ...("map_lat" in f && { map_lat: f.map_lat === "" ? null : f.map_lat, map_lng: f.map_lng === "" ? null : f.map_lng }) };
    const { error } = await supabase.from("settings").update(row).eq("id", 1);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
  const SaveBar = () => (
    <div className="flex justify-end">
      <Button onClick={save} disabled={busy || !f}>{busy ? "Saving…" : "Save changes"}</Button>
    </div>
  );
  return { f, bind, SaveBar };
}
