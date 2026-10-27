import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { BubbleChatIcon, Calendar03Icon, Home01Icon, Logout01Icon, Task01Icon, UserGroupIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { Button, Card, Icon, Spinner } from "@/components/ui";
import { useAuth, useStaff } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { cn } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { session, ready } = useAuth();
  const staff = useStaff();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login", search: { next: "/admin" } });
  }, [ready, session, navigate]);

  if (!ready || !session || staff.isLoading) return <Spinner />;
  if (!staff.data)
    return (
      <div className="mx-auto max-w-sm px-4 pt-24">
        <Card>
          <p className="font-semibold">This account isn't on the team</p>
          <p className="mt-1 text-sm text-neutral-500">{session.user.email} can book as a guest. Ask the owner to add you under Team.</p>
          {staff.error && <p className="mt-2 text-xs text-red-600">{(staff.error as Error).message}</p>}
          <div className="mt-4 flex gap-2">
            <Link to="/" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium">Guest site</Link>
            <Button tone="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </div>
        </Card>
      </div>
    );

  return <Shell owner={staff.data.role === "owner"} name={staff.data.name} />;
}

function Shell({ owner, name }: { owner: boolean; name: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const settings = useSettings().data;
  const qc = useQueryClient();

  // Every phone at the desk sees a new booking within seconds.
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

  const counts = useQuery({
    queryKey: ["nav-counts"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [threads, receipts] = await Promise.all([
        supabase.from("threads").select("id", { count: "exact", head: true }).eq("unread", true),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      ]);
      return { unread: threads.count ?? 0, receipts: receipts.count ?? 0 };
    },
  });

  const tabs = [
    { to: "/admin", label: "Home", icon: Home01Icon, exact: true },
    { to: "/admin/inbox", label: "Inbox", icon: BubbleChatIcon, badge: counts.data?.unread },
    { to: "/admin/bookings", label: "Bookings", icon: Task01Icon, badge: counts.data?.receipts },
    { to: "/admin/calendar", label: "Calendar", icon: Calendar03Icon },
    ...(owner
      ? [
          { to: "/admin/finance", label: "Finance", icon: Wallet01Icon },
          { to: "/admin/team", label: "Team", icon: UserGroupIcon },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <div>
            <p className="text-sm font-semibold leading-tight">{settings?.resort_name ?? "Beach Villas"}</p>
            <p className="text-xs leading-tight text-neutral-500">{name} · {owner ? "Owner" : "Staff"}</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Sign out">
            <Icon icon={Logout01Icon} size={18} />
          </button>
        </div>
      </header>

      <main className={cn("pb-tabbar mx-auto px-4 pt-4", path.startsWith("/admin/calendar") ? "max-w-6xl" : "max-w-xl")}>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          {tabs.map((t) => {
            const active = t.exact ? path === t.to || path === `${t.to}/` : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={cn("relative flex min-w-14 flex-col items-center rounded-full px-3 py-1.5", active ? "bg-neutral-900 text-white" : "text-neutral-500")}>
                <Icon icon={t.icon} />
                <span className="text-[11px] font-medium">{t.label}</span>
                {!!t.badge && (
                  <span className="absolute right-1 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{t.badge}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
