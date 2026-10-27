import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/obs/app-shell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  return (
    <AppShell>
      <Live />
      <Outlet />
    </AppShell>
  );
}

/** Every phone at the desk sees a new booking within seconds. */
function Live() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("desk")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => qc.invalidateQueries())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => qc.invalidateQueries())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["inbox"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  return null;
}
