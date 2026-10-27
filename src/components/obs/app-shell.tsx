import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "@/components/icons";
import { NAV_PILL, NavPillBadge, navPillDock, navPillTab, useNavPillIsAway, useTyping } from "@/components/nav-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth, useStaff } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { BookingDialog, useBookingDialog } from "./booking-dialog";
import { ClearFilters, DatePicker, FilterSheet, ScopePicker } from "./scope-bar";
import { MasterCalendarButton } from "./week-grid";
import { AdminBell } from "@/components/notification-bell";
import { LoadingState } from "./states";

/**
 * The admin's frame, Malaya's AppShell with fewer sections: a floating sidebar
 * card with foldable groups, the content as a card beside it scrolling inside
 * itself, a breadcrumb bar with the section's sub-tabs as a pill, the account
 * menu, and on a phone the nav pill along the bottom with More for the rest
 * and a round + for a walk-in.
 */

interface SubTab {
  to: string;
  label: string;
}
interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  owner?: boolean;
  badge?: "unread" | "receipts";
  subTabs?: SubTab[];
}

const NAV: { label: string; tabs: Tab[] }[] = [
  { label: "Overview", tabs: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Front desk",
    tabs: [
      { to: "/admin/inbox", label: "Inbox", icon: MessagesSquare, badge: "unread" },
      {
        to: "/admin/bookings",
        label: "Bookings",
        icon: ClipboardCheck,
        badge: "receipts",
        subTabs: [
          { to: "/admin/bookings", label: "Reservations" },
          { to: "/admin/bookings/today", label: "Today" },
          { to: "/admin/bookings/requests", label: "Requests" },
          { to: "/admin/bookings/guests", label: "Guests" },
        ],
      },
      { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Money",
    tabs: [
      {
        to: "/admin/finance",
        label: "Finance",
        icon: Wallet,
        owner: true,
        subTabs: [
          { to: "/admin/finance", label: "Collections" },
          { to: "/admin/finance/close", label: "Daily close" },
          { to: "/admin/finance/expenses", label: "Expenses" },
          { to: "/admin/finance/cottages", label: "Per cottage" },
        ],
      },
    ],
  },
  {
    label: "Resort",
    tabs: [
      { to: "/admin/team", label: "Team", icon: Users, owner: true },
      {
        to: "/admin/settings",
        label: "Settings",
        icon: Settings2,
        owner: true,
        subTabs: [
          { to: "/admin/settings", label: "General" },
          { to: "/admin/settings/cottages", label: "Cottages & rates" },
          { to: "/admin/settings/payments", label: "Payments" },
          { to: "/admin/settings/quick-replies", label: "Quick replies" },
        ],
      },
    ],
  },
];

const PILL_TABS = ["/admin", "/admin/inbox", "/admin/bookings"];
const SIDEBAR_KEY = "beach:sidebar-collapsed";
const NAV_GROUPS_KEY = "beach:nav-collapsed";

const TOP_PILL = "flex items-center gap-0.5 rounded-full border border-border/70 bg-card p-0.5 shadow-level-2";

function isActive(to: string, pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  return to === "/admin" ? path === "/admin" : path === to || path.startsWith(`${to}/`);
}

function useBadges() {
  const q = useQuery({
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
  return q.data ?? { unread: 0, receipts: 0 };
}

function useTabs() {
  const owner = useStaff().data?.role === "owner";
  return NAV.map((g) => ({ ...g, tabs: g.tabs.filter((t) => owner || !t.owner) })).filter((g) => g.tabs.length);
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  const name = useSettings().data?.resort_name ?? "Beach Villas";
  if (compact) return <p className="font-display text-lg tracking-[0.12em] text-sidebar-foreground" aria-hidden>{name[0]}</p>;
  return (
    <div className="leading-tight">
      <p className="font-display text-[15px] uppercase tracking-[0.18em] text-sidebar-foreground">{name}</p>
      <p className="text-[10px] uppercase tracking-[0.1em] text-sidebar-foreground/60">Resort admin</p>
    </div>
  );
}

function NavList({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = useTabs();
  const badges = useBadges();
  const [folded, setFolded] = useState<string[]>([]);

  useEffect(() => {
    try {
      setFolded(JSON.parse(localStorage.getItem(NAV_GROUPS_KEY) ?? "[]") as string[]);
    } catch {
      /* storage blocked: everything stays open */
    }
  }, []);
  const toggle = (label: string) =>
    setFolded((cur) => {
      const next = cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label];
      try {
        localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <nav className={cn("no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-6", collapsed ? "px-2" : "px-3")}>
      {groups.map((group, gi) => {
        const hasActive = group.tabs.some((t) => isActive(t.to, pathname));
        const isFolded = !collapsed && folded.includes(group.label) && !hasActive;
        return (
          <div key={group.label} className={gi > 0 ? (collapsed ? "mt-2" : "mt-5") : ""}>
            {collapsed ? (
              gi > 0 && <div aria-hidden className="h-2" />
            ) : (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={!isFolded}
                className="flex w-full items-center gap-1.5 rounded-lg px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/70"
              >
                <ChevronRight className={cn("size-3 shrink-0 transition-transform", !isFolded && "rotate-90")} />
                <span className="truncate">{group.label.toUpperCase()}</span>
              </button>
            )}
            {!isFolded && (
              <div className="flex flex-col gap-1">
                {group.tabs.map((tab) => {
                  const Icon = tab.icon;
                  const count = tab.badge ? badges[tab.badge] : 0;
                  const link = (
                    <Link
                      key={tab.to}
                      to={tab.to}
                      onClick={onNavigate}
                      activeOptions={{ exact: tab.to === "/admin" }}
                      aria-label={collapsed ? tab.label : undefined}
                      className={cn(
                        "group flex items-center rounded-full text-[15px] text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-foreground",
                        collapsed ? "mx-auto size-10 justify-center" : "gap-3 px-3 py-2.5",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className="size-[18px] opacity-80 group-data-[status=active]:opacity-100" />
                        {collapsed && count > 0 && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar" />}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="truncate">{tab.label}</span>
                          {count > 0 && (
                            <span className="ml-auto shrink-0 rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-sidebar-primary-foreground" title={`${count} waiting`}>
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={tab.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Breadcrumbs({ tab, pathname }: { tab: Tab | undefined; pathname: string }) {
  const sub = tab?.subTabs?.find((s) => pathname === s.to || pathname === `${s.to}/`);
  const crumbs: { label: string; to: string }[] = [];
  if (tab) crumbs.push({ label: tab.label, to: tab.to });
  if (sub && sub.to !== tab?.to) crumbs.push({ label: sub.label, to: sub.to });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-[15px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.to} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
              <Link
                to={c.to}
                aria-current={last ? "page" : undefined}
                className={cn("-mx-1 truncate rounded-md px-1 py-0.5 underline-offset-4 transition-colors hover:underline", last ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return <span className={cn("grid place-items-center bg-secondary font-display text-sm text-foreground", className)}>{initials || "?"}</span>;
}

function AccountMenu({ align = "end" }: { align?: "start" | "end" }) {
  const { session } = useAuth();
  const staff = useStaff().data;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-11 overflow-hidden rounded-full border-2 border-card p-0 shadow-level-2 lg:size-10" aria-label="Account menu">
          <Avatar name={staff?.name ?? session?.user.email ?? "?"} className="size-full" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} collisionPadding={12} className="w-[calc(100vw-1.5rem)] sm:w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{staff?.name ?? "Signed in"}</p>
          <p className="truncate text-xs text-muted-foreground">{session?.user.email}</p>
          {staff && <Badge variant="outline" className="mt-2">{staff.role === "owner" ? "Owner" : "Staff"}</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 size-4" /> Open the guest site
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void supabase.auth.signOut()}>
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavPill({ onMore, onAdd }: { onMore: () => void; onAdd: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const typing = useTyping();
  const away = useNavPillIsAway();
  const badges = useBadges();
  const all = NAV.flatMap((g) => g.tabs);
  const tabs = PILL_TABS.map((to) => all.find((t) => t.to === to)!).map((t) => (t.to === "/admin" ? { ...t, label: "Home" } : t));
  const onATab = tabs.some((t) => isActive(t.to, pathname));
  const hidden = typing || away;
  return (
    <div aria-hidden={hidden || undefined} className={cn(navPillDock(hidden), "lg:hidden")}>
      <nav aria-label="Main sections" className={NAV_PILL}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.to, pathname);
          return (
            <Link key={tab.to} to={tab.to} aria-current={active ? "page" : undefined} className={navPillTab(active)}>
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <NavPillBadge count={tab.badge ? badges[tab.badge] : 0} />
              </span>
              <span className="max-w-full truncate px-1">{tab.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className={navPillTab(!onATab)}>
          <MoreHorizontal className="size-[22px]" strokeWidth={1.8} aria-hidden />
          <span>More</span>
        </button>
      </nav>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Walk-in"
        className="flex size-[62px] shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-level-2 transition-transform duration-200 active:scale-90"
      >
        <Plus className="size-7" />
      </button>
    </div>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const booking = useBookingDialog();
  const fullBleed = pathname.startsWith("/admin/inbox");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* keep default */
    }
  }, []);
  const toggleSidebar = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });

  const tab = useMemo(() => NAV.flatMap((g) => g.tabs).filter((t) => isActive(t.to, pathname)).sort((a, b) => b.to.length - a.to.length)[0], [pathname]);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-surface-muted [--mobile-nav-space:calc(5.75rem+env(safe-area-inset-bottom))] lg:[--mobile-nav-space:0px]">
        <aside className={cn("fixed inset-y-3 left-3 z-40 hidden flex-col overflow-hidden rounded-2xl bg-sidebar shadow-level-2 transition-[width] duration-200 lg:flex", collapsed ? "w-[64px]" : "w-[248px]")}>
          <div className={cn("flex", collapsed ? "flex-col items-center gap-1 px-0 pb-3 pt-4" : "items-center justify-between px-5 pb-5 pt-6")}>
            <Wordmark compact={collapsed} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="size-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
                  {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{collapsed ? "Expand" : "Collapse"}</TooltipContent>
            </Tooltip>
          </div>
          <NavList collapsed={collapsed} />
        </aside>

        <div className={cn("transition-[padding] duration-200 lg:py-3 lg:pr-3", collapsed ? "lg:pl-[88px]" : "lg:pl-[272px]")}>
          <div className="relative flex min-h-screen flex-col lg:h-[calc(100vh-1.5rem)] lg:min-h-0 lg:overflow-hidden lg:rounded-2xl lg:bg-card lg:shadow-level-2">
            <header className="sticky top-0 z-30 bg-surface-muted/85 backdrop-blur-xl lg:static lg:bg-card/85">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:py-2">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetContent side="left" className="flex w-[272px] flex-col gap-0 bg-sidebar p-0">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <div className="shrink-0 px-5 pb-5 pt-6"><Wordmark /></div>
                    <NavList onNavigate={() => setMobileOpen(false)} />
                  </SheetContent>
                </Sheet>
                <Breadcrumbs tab={tab} pathname={pathname} />
                <div className="hidden items-center gap-2.5 lg:flex">
                  <div className={TOP_PILL}>
                    <ScopePicker className="max-w-[200px]" />
                    <span aria-hidden className="h-5 w-px bg-border" />
                    <DatePicker />
                    <ClearFilters />
                  </div>
                  <div className={cn(TOP_PILL, "p-0.5")}>
                    <MasterCalendarButton />
                    <AdminBell />
                  </div>
                  <div className={TOP_PILL}>
                    <Button variant="ghost" className="rounded-full" onClick={() => booking.open({ source: "walk_in" })}>
                      <Plus className="size-4" /> Walk-in
                    </Button>
                    <Button variant="ghost" className="rounded-full" onClick={() => booking.open({ source: "messenger" })}>
                      Add booking
                    </Button>
                  </div>
                  <AccountMenu />
                </div>
                <div className="flex w-full items-center justify-between gap-3 lg:hidden">
                  <AccountMenu align="start" />
                  <div className={cn(TOP_PILL, "p-1")}>
                    <MasterCalendarButton />
                    <AdminBell />
                    <FilterSheet />
                  </div>
                </div>
              </div>
              {tab?.subTabs && (
                <div className="flex items-center gap-2 px-4 pb-2 sm:px-6 lg:pt-0.5">
                  <div className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-border/70 bg-card p-1 shadow-level-1 sm:flex-wrap sm:overflow-visible sm:rounded-[22px]">
                    {tab.subTabs.map((sub) => (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        activeOptions={{ exact: true }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:font-medium data-[status=active]:text-primary"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </header>

            <main className="relative min-h-0 flex-1 lg:overflow-y-auto">
              <div
                className={cn(
                  fullBleed
                    ? "w-full px-3 pb-[calc(var(--mobile-nav-space)+0.75rem)] pt-3 sm:px-4 lg:flex lg:h-full lg:flex-col lg:pb-3"
                    : "mx-auto w-full max-w-[1500px] px-4 pb-[calc(var(--mobile-nav-space)+1.5rem)] pt-6 sm:px-6 sm:pt-8 lg:pb-8",
                )}
              >
                {children}
              </div>
            </main>
          </div>
        </div>

        <MobileNavPill onMore={() => setMobileOpen(true)} onAdd={() => booking.open({ source: "walk_in" })} />
        <BookingDialog />
      </div>
    </TooltipProvider>
  );
}

/** Staff only, by construction: the gate is inside the shell. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const staff = useStaff();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !session) navigate({ to: "/login", search: { next: "/admin" } });
  }, [ready, session, navigate]);

  if (!ready || !session || staff.isLoading)
    return (
      <div className="mx-auto max-w-5xl p-6">
        <LoadingState />
      </div>
    );
  if (!staff.data)
    return (
      <div className="grid min-h-screen place-items-center bg-surface-muted px-4">
        <div className="max-w-sm rounded-2xl bg-card p-6 text-center shadow-level-2">
          <h1 className="font-display text-xl">This account isn't on the team</h1>
          <p className="mt-2 text-sm text-muted-foreground">{session.user.email} can book as a guest. Ask the owner to add you under Team.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" asChild><a href="/">Guest site</a></Button>
            <Button onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  return <ShellInner>{children}</ShellInner>;
}

/** Owner-only pages render this for staff who type the URL. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const role = useStaff().data?.role;
  if (role !== "owner")
    return <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">This page is for the owner.</p>;
  return <>{children}</>;
}
