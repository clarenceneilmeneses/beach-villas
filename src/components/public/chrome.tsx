import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CalendarCheck, Mail, MapPin, MessageCircle, Phone, Search, UserRound } from "@/components/icons";
import { NAV_PILL, navPillDock, navPillTab, useNavPillIsAway, useTyping } from "@/components/nav-pill";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The guest site's frame, Malaya's public chrome: wordmark, a centred caps
 * nav, Sign in and a Book now pill; a four-column footer; on a phone the
 * floating nav pill and a round chat button.
 */
export function Wordmark({ className }: { className?: string }) {
  const name = useSettings().data?.resort_name ?? "Beach Villas";
  return (
    <Link to="/" className={cn("whitespace-nowrap font-display text-[22px] uppercase leading-none tracking-[0.08em] text-foreground sm:text-[26px]", className)}>
      {name}
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Cottages", exact: true },
  { to: "/about", label: "About" },
  { to: "/my", label: "My bookings" },
  { to: "/messages", label: "Messages" },
];

function Header() {
  const { session } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-4 sm:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-10 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              className="site-display border-b-2 border-transparent pb-1 text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground data-[status=active]:border-foreground data-[status=active]:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {session ? (
            <Link to="/my" className="site-display hidden text-[15px] font-medium text-foreground/80 hover:text-foreground sm:block">Account</Link>
          ) : (
            <Link to="/login" search={{ next: path }} className="site-display hidden text-[15px] font-medium text-foreground/80 hover:text-foreground sm:block">Sign in</Link>
          )}
          <Button asChild className="site-display h-10 rounded-full px-5 text-[15px]">
            <Link to="/" hash="cottages">Book now</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const s = useSettings().data;
  const col = "space-y-3 text-sm";
  const head = "site-display mb-4 text-[15px] font-semibold";
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Wordmark className="text-[34px]" />
          <p className="site-display text-sm font-medium">{s?.tagline}</p>
          {s?.address && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /> {s.address}</p>}
        </div>
        <div className={col}>
          <p className={head}>Explore</p>
          <Link to="/" className="block hover:underline">Cottages</Link>
          <Link to="/about" className="block hover:underline">About</Link>
        </div>
        <div className={col}>
          <p className={head}>Support</p>
          <Link to="/my" className="flex items-center gap-2 hover:underline"><CalendarCheck className="size-4" /> My bookings</Link>
          <Link to="/messages" className="flex items-center gap-2 hover:underline"><MessageCircle className="size-4" /> Message us</Link>
          {s?.messenger_url && <a href={s.messenger_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><MessageCircle className="size-4" /> Messenger</a>}
          {s?.whatsapp_number && <a href={`tel:${s.whatsapp_number}`} className="flex items-center gap-2 hover:underline"><Phone className="size-4" /> {s.whatsapp_number}</a>}
        </div>
        <div className={col}>
          <p className={head}>Policies</p>
          <Link to="/about" hash="policy" className="block hover:underline">Booking policy</Link>
          <Link to="/about" hash="rules" className="block hover:underline">House rules</Link>
          {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><Mail className="size-4" /> Facebook page</a>}
        </div>
      </div>
      <p className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {s?.resort_name ?? "Beach Villas"}. All rights reserved.</p>
    </footer>
  );
}

function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const typing = useTyping();
  const away = useNavPillIsAway();
  const tabs = [
    { to: "/", label: "Explore", icon: Search, active: path === "/" || path.startsWith("/cottages") || path.startsWith("/book") },
    { to: "/my", label: "Bookings", icon: CalendarCheck, active: path.startsWith("/my") },
    { to: "/messages", label: "Messages", icon: MessageCircle, active: path.startsWith("/messages") },
    { to: "/about", label: "About", icon: UserRound, active: path.startsWith("/about") },
  ];
  return (
    <div className={cn(navPillDock(typing || away), "md:hidden")}>
      <nav className={NAV_PILL}>
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={navPillTab(t.active)}>
            <t.icon className="size-[22px]" strokeWidth={t.active ? 2.2 : 1.8} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PublicShell({ children, hideFooter = false }: { children: ReactNode; hideFooter?: boolean }) {
  return (
    <div className="min-h-dvh bg-background pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
      <Header />
      <main>{children}</main>
      {!hideFooter && <Footer />}
      <Link
        to="/messages"
        aria-label="Message us"
        className="fixed bottom-6 right-6 z-30 hidden size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-level-3 transition-transform hover:scale-105 md:grid"
      >
        <MessageCircle className="size-6" />
      </Link>
      <BottomNav />
    </div>
  );
}

/** A photo's place until the owner sends real ones: a soft tile with the name's initials. */
export function PhotoTile({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn("grid place-items-center overflow-hidden bg-gradient-to-br from-secondary via-muted to-accent", className)}>
      <span className="font-display text-2xl tracking-[0.3em] text-foreground/30">{initials}</span>
    </div>
  );
}
