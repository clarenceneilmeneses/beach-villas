import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PublicShell } from "@/components/public/chrome";
import { AuthPanel } from "@/components/public/auth-panel";
import { Card, CardContent } from "@/components/ui/card";
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
    void (async () => {
      const { data } = await supabase.from("staff").select("email").ilike("email", session.user.email ?? "").maybeSingle();
      navigate({ to: next ?? (data ? "/admin" : "/my") });
    })();
  }, [session, next, navigate]);

  return (
    <PublicShell hideFooter>
      <div className="grid place-items-center px-4 py-16">
        <Card className="w-full max-w-sm rounded-3xl border-border/70 shadow-level-3">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div>
              <h1 className="site-display text-2xl">Welcome</h1>
              <p className="text-sm text-muted-foreground">Sign in to book and see your bookings. Staff sign in here too.</p>
            </div>
            <AuthPanel />
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
