import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => (typeof s.next === "string" ? { next: s.next } : {}),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) return;
    // Staff land on the admin; guests go back where they came from.
    (async () => {
      const { data } = await supabase.from("staff").select("email").ilike("email", session.user.email ?? "").maybeSingle();
      navigate({ to: next ?? (data ? "/admin" : "/my") });
    })();
  }, [session, next, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-4 text-xl font-semibold">Welcome</h1>
        <AuthPanel />
      </Card>
    </div>
  );
}
