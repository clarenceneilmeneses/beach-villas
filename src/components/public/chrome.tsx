import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  FileText,
  Info,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  User,
} from "@/components/icons";
import { NAV_PILL, navPillDock, navPillTab, useNavPillIsAway, useTyping } from "@/components/nav-pill";
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
import { useAuth } from "@/lib/auth";
import { GuestBell } from "@/components/notification-bell";
import { shortName, useSettings } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * The guest site's frame, Malaya's public chrome.
 *
 * Laptop: the white header bar on every page (wordmark, caps nav, Sign in or
 * the account menu, Book now). Phone: no bar — on Explore the wordmark sits
 * on the page with the account pill on the right; every other screen is its
 * own page with a Back button, and the bottom nav pill with the round chat
 * button beside it does the rest. The footer is Explore's only.
 */
export function Wordmark({ className }: { className?: string }) {
  const name = shortName(useSettings().data);
  return (
    <Link
      to="/"
      className={cn(
        "font-display uppercase tracking-[0.08em] text-foreground",
        // A long name wraps to two balanced lines on a phone instead of pushing the bar.
        name.length > 18 ? "max-w-[16ch] text-balance text-[18px] leading-[1.1] sm:max-w-none sm:text-[22px] lg:whitespace-nowrap" : "whitespace-nowrap text-[22px] leading-none sm:text-[26px]",
        className,
      )}
    >
      {name}
    </Link>
  );
}

const TOP_PILL = "flex items-center gap-0.5 rounded-full border border-border/70 bg-card shadow-level-2";

function AccountMenu() {
  const { session } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(TOP_PILL, "size-10 justify-center")} aria-label="Account">
          <User className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{session?.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/my"><CalendarCheck className="mr-2 size-4" /> My bookings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/messages"><MessageCircle className="mr-2 size-4" /> Messages</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void supabase.auth.signOut()}><LogOut className="mr-2 size-4" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The laptop's white bar, on every page. */
function DesktopHeader() {
  const { session } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/60 bg-card/95 backdrop-blur md:block">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-8">
        <Wordmark />
        <nav className="flex items-center gap-10">
          {[
            { to: "/", label: "Cottages", exact: true },
            { to: "/about", label: "About" },
            { to: "/my", label: "My bookings" },
          ].map((n) => (
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
            <>
              <div className={cn(TOP_PILL, "p-0.5")}><GuestBell /></div>
              <AccountMenu />
            </>
          ) : (
            <Link to="/login" search={{ next: path }} className="site-display text-[15px] font-medium text-foreground/80 hover:text-foreground">Sign in</Link>
          )}
          <Button asChild className="site-display h-10 rounded-full px-5 text-[15px]">
            <Link to="/" hash="cottages">Book now</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Explore's top on a phone: the wordmark on the page, the account pill on the right. No bar. */
function PhoneTop() {
  const { session } = useAuth();
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-4 md:hidden">
      <Wordmark />
      {session ? (
        <div className={cn(TOP_PILL, "p-1")}>
          <GuestBell />
          <Link to="/my" className="grid size-9 place-items-center rounded-full text-foreground/75 hover:bg-secondary" aria-label="My bookings"><User className="size-[18px]" /></Link>
        </div>
      ) : (
        <Button asChild size="sm" className="site-display h-10 rounded-full px-5 text-[15px]"><Link to="/login">Sign in</Link></Button>
      )}
    </div>
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

/** "More" on the phone: everything that isn't a tab. */
function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { session } = useAuth();
  const s = useSettings().data;
  const row = "flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-secondary";
  const close = () => onOpenChange(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetTitle className="font-display text-lg">More</SheetTitle>
        {session && <p className="mt-1 truncate text-sm text-muted-foreground">{session.user.email}</p>}
        <div className="mt-4 grid gap-1">
          <Link to="/messages" onClick={close} className={row}><MessageCircle className="size-5" /> Messages</Link>
          <Link to="/about" onClick={close} className={row}><Info className="size-5" /> About</Link>
          <Link to="/about" hash="policy" onClick={close} className={row}><FileText className="size-5" /> Booking policy & house rules</Link>
          {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noreferrer" className={row}><Mail className="size-5" /> Facebook page</a>}
          {session ? (
            <button type="button" onClick={() => { void supabase.auth.signOut(); close(); }} className={cn(row, "text-destructive")}><LogOut className="size-5" /> Sign out</button>
          ) : (
            <Link to="/login" onClick={close} className={row}><User className="size-5" /> Sign in</Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Malaya's phone nav: Explore, Bookings, About and More in one pill, the round chat button beside it. */
function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const typing = useTyping();
  const away = useNavPillIsAway();
  const [more, setMore] = useState(false);
  const tabs = [
    { to: "/", label: "Explore", icon: Search, active: path === "/" || path.startsWith("/cottages") || path.startsWith("/book") },
    { to: "/my", label: "Bookings", icon: CalendarCheck, active: path.startsWith("/my") },
    { to: "/about", label: "About", icon: Info, active: path.startsWith("/about") },
  ];
  return (
    <>
      <div className={cn(navPillDock(typing || away), "md:hidden")}>
        <nav className={NAV_PILL}>
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className={navPillTab(t.active)}>
              <t.icon className="size-[22px]" strokeWidth={t.active ? 2.2 : 1.8} />
              <span>{t.label}</span>
            </Link>
          ))}
          <button type="button" onClick={() => setMore(true)} className={navPillTab(false)}>
            <MoreHorizontal className="size-[22px]" strokeWidth={1.8} />
            <span>More</span>
          </button>
        </nav>
        <Link
          to="/messages"
          aria-label="Messages"
          className="grid size-[62px] shrink-0 place-items-center rounded-full border border-border/70 bg-card text-foreground shadow-level-2 transition-transform active:scale-90"
        >
          <MessageCircle className="size-7" />
        </Link>
      </div>
      <MoreSheet open={more} onOpenChange={setMore} />
    </>
  );
}

/** Back, as on Malaya's villa page: the previous page if there is one, else Explore. */
export function BackButton({ label = "Back", className }: { label?: string; className?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      className={cn("rounded-full", className)}
      onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
    >
      <ArrowLeft className="size-4" /> {label}
    </Button>
  );
}

export function PublicShell({ children, explore = false }: { children: ReactNode; explore?: boolean; hideFooter?: boolean }) {
  return (
    <div className="min-h-dvh bg-background pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
      <DesktopHeader />
      {explore && <PhoneTop />}
      <main>{children}</main>
      {explore && <Footer />}
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
export function PhotoTile({ name, src, className }: { name: string; src?: string; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (src) return <img src={src} alt={name} loading="lazy" decoding="async" className={cn("block bg-secondary object-cover", className)} />;
  return (
    <div className={cn("grid place-items-center overflow-hidden bg-gradient-to-br from-secondary via-muted to-accent", className)}>
      <span className="font-display text-2xl tracking-[0.3em] text-foreground/30">{initials}</span>
    </div>
  );
}
