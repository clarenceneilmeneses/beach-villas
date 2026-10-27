import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { BubbleChatIcon, CalendarCheckIn01Icon, Facebook01Icon, MessengerIcon, Search01Icon, ViberIcon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { useSettings } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { Icon, Sheet } from "./ui";

export function GuestShell({ children }: { children: ReactNode }) {
  const settings = useSettings().data;
  const { session } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [chat, setChat] = useState(false);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link to="/" className="text-base font-semibold tracking-tight">{settings?.resort_name ?? "Beach Villas"}</Link>
          {session ? (
            <Link to="/my" className="text-sm font-medium text-neutral-600">My bookings</Link>
          ) : (
            <Link to="/login" search={{ next: path }} className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium">Sign in</Link>
          )}
        </div>
      </header>

      <main className="pb-tabbar mx-auto max-w-xl px-4 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-1 rounded-full border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          <Tab to="/" active={path === "/" || path.startsWith("/book")} icon={Search01Icon} label="Book" />
          <Tab to="/my" active={path.startsWith("/my")} icon={CalendarCheckIn01Icon} label="Bookings" />
          <button onClick={() => setChat(true)} className="flex flex-col items-center rounded-full px-5 py-1.5 text-neutral-500">
            <Icon icon={BubbleChatIcon} />
            <span className="text-[11px] font-medium">Chat</span>
          </button>
        </div>
      </nav>

      <Sheet open={chat} onClose={() => setChat(false)} title="Message us">
        <p className="mb-4 text-sm text-neutral-500">We reply fastest on Messenger. Send your booking number if you have one.</p>
        <div className="grid gap-2">
          <ChatLink href={settings?.messenger_url || "https://m.me/"} icon={MessengerIcon} label="Messenger" />
          <ChatLink href={`https://wa.me/${(settings?.whatsapp_number ?? "").replace(/\D/g, "")}`} icon={WhatsappIcon} label="WhatsApp" />
          <ChatLink href={`viber://chat?number=${encodeURIComponent(settings?.viber_number ?? "")}`} icon={ViberIcon} label="Viber" />
          <ChatLink href={settings?.facebook_url || "https://facebook.com/"} icon={Facebook01Icon} label="Facebook page" />
        </div>
      </Sheet>
    </div>
  );
}

function Tab({ to, active, icon, label }: { to: string; active: boolean; icon: any; label: string }) {
  return (
    <Link to={to} className={cn("flex flex-col items-center rounded-full px-5 py-1.5", active ? "bg-neutral-900 text-white" : "text-neutral-500")}>
      <Icon icon={icon} />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

const ChatLink = ({ href, icon, label }: { href: string; icon: any; label: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 font-medium hover:bg-neutral-50">
    <Icon icon={icon} /> {label}
  </a>
);
