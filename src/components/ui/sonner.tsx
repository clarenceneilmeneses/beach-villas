import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Top-right, since 2026-09-17 — the tester's ask. Sonner's default is the
 * bottom-right, which on the public pages is where the Messages bubble
 * already sits, so a "Receipt sent" toast landed on top of it. A caller can
 * still pass `position` to override.
 *
 * Every toast has an X, and they start BELOW the top bar — Clarence,
 * 2026-10-18: "there's no x btn on the admin notifs pop up so u have to wait
 * it out just to access/see the bell". At Sonner's default offset a new-booking
 * pop-up sat on top of the bell for its full eight seconds. 5rem clears the
 * admin bar (about 64px with the inset card) and the public header; a phone's
 * bar is shorter.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      offset={{ top: "5rem" }}
      mobileOffset={{ top: "4.5rem" }}
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:text-foreground/70 group-[.toast]:hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
