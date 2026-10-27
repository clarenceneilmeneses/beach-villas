/**
 * The phone's floating nav pill, as one look across the whole system.
 *
 * The admin's pill (components/obs/mobile-nav-pill.tsx, 2026-10-02) set it:
 * frosted glass, an icon over a short label in every slot, the open one on a
 * soft fill, a red count on the icon's corner, and the whole bar sliding out
 * of the way while somebody types. The same day Clarence asked for it
 * everywhere — "adapt the updated admin pill to guest side too, actually
 * adapt to all portals" — so the guest site's pill
 * (components/public/bottom-nav.tsx) and every portal's
 * (components/obs/portal-shell.tsx) are drawn from these pieces rather than
 * from three copies of the class strings that would drift apart.
 *
 * Only the look and the typing rule are shared. Each pill keeps its own
 * tabs and its own idea of which one is open: the admin's follow
 * permissions, the guest's follow the account, a portal's are its sections.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * True while somebody is typing: a text field, a text area, or an editor.
 *
 * On a phone that is the keyboard coming up, and a bar riding on top of it
 * hides the very line being typed — a reply box, a form, a review.
 */
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isText = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
      return (
        el instanceof HTMLInputElement &&
        !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(el.type)
      );
    };
    const onIn = (e: FocusEvent) => setTyping(isText(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}

/*
 * A screen that needs the bottom edge to itself — an open conversation, whose
 * reply box sits there — sends the pill away while it is open. The typing
 * rule above was not enough: it hides the pill once the reply box has focus,
 * and the pill was covering the reply box, so there was nothing to tap
 * (Clarence, 2026-10-21, a CSR's screenshot: "Natatakpan ata?"). Chat apps
 * do the same: no tab bar inside a conversation, and Back brings it back.
 */
let awayCount = 0;
const awayListeners = new Set<() => void>();
const notifyAway = () => awayListeners.forEach((listener) => listener());

/** Send the pill away while `away` is true and the caller is mounted. */
export function useNavPillAway(away: boolean): void {
  useEffect(() => {
    if (!away) return;
    awayCount += 1;
    notifyAway();
    return () => {
      awayCount -= 1;
      notifyAway();
    };
  }, [away]);
}

/** True while some screen has sent the pill away. */
export function useNavPillIsAway(): boolean {
  return useSyncExternalStore(
    (listener) => {
      awayListeners.add(listener);
      return () => awayListeners.delete(listener);
    },
    () => awayCount > 0,
    () => false,
  );
}

/**
 * The fixed strip the pill floats in: full width less a gutter, clear of the
 * bottom edge and of an iPhone's home indicator. `hidden` drops it below the
 * screen; the caller adds the breakpoint it disappears at.
 */
export function navPillDock(hidden: boolean): string {
  return cn(
    "fixed inset-x-0 bottom-0 z-40 flex items-end gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 motion-reduce:transition-none",
    hidden && "pointer-events-none translate-y-[150%]",
  );
}

/**
 * The pill itself. Solid since 2026-10-20 (Clarence: "make the nav 100%
 * visible instead of semi transparent for better usability"): page text
 * showing through it made the labels harder to read.
 */
export const NAV_PILL =
  "relative flex min-w-0 flex-1 items-stretch gap-0.5 rounded-full border border-border/70 bg-card p-1.5 shadow-level-2";

/** One slot: icon over label. `active` is the soft fill the admin uses. */
export function navPillTab(active: boolean, filled = true): string {
  return cn(
    "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    active ? cn("text-primary", filled && "bg-secondary") : "text-muted-foreground",
  );
}

/** The count on an icon's corner. Nothing at zero. */
export function NavPillBadge({
  count,
  tone = "alert",
}: {
  count: number;
  tone?: "alert" | "quiet";
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold leading-none",
        tone === "alert"
          ? "bg-destructive text-destructive-foreground"
          : "bg-primary text-primary-foreground",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
