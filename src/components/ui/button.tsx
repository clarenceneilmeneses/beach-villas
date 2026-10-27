import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-[color,background-color,border-color,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        /*
         * BUTTONS SAY WHAT THEY DO (2026-10-09). Clarence: "some buttons dont
         * look like one. if a button does something positive then use the
         * color that corresponds to that action along with deletion and stuff
         * with their red". So:
         *
         *   success              Approve, Verify, Mark paid, Settle, Accept —
         *                        the action that moves something forward.
         *   destructive-outline  Reject, Decline, Remove, Cancel booking,
         *                        Delete — on the page, before anything is
         *                        final. The confirm dialog behind it keeps the
         *                        solid `destructive`.
         *   outline              everything else with words on it, Cancel
         *                        included.
         *
         * `ghost` is for icon-only buttons (✕, ⋯, arrows), whose icon already
         * says "press me". A ghost button with words reads as plain text.
         */
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        "destructive-outline":
          "border border-destructive/40 bg-background text-destructive shadow-[0_1px_0_color-mix(in_oklab,var(--destructive)_40%,transparent),0_2px_3px_rgb(0_0_0/0.06)] hover:bg-destructive/10 hover:text-destructive",
        // The 1px ledge under the edge is what makes a white button read as
        // something to press rather than a label (2026-10-22, "CSRs not
        // noticing these are buttons at all").
        outline:
          "border border-control bg-background shadow-[0_1px_0_var(--control),0_2px_3px_rgb(0_0_0/0.06)] hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, title, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // An icon-only button says what it does on hover (2026-10-22, "buttons that
    // look like buttons", round 4). Its aria-label already names it for screen
    // readers; the same words become the tooltip unless a title is given.
    const label = props["aria-label"];
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        title={title ?? (typeof label === "string" ? label : undefined)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
