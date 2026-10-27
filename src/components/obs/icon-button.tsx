/**
 * An icon-only button that always says what it does.
 *
 * WHY THIS EXISTS
 *
 * Twenty-four buttons across the admin were an icon and nothing else. Most
 * carried an `aria-label`, so a screen reader read them correctly — and a
 * sighted user hovering a pencil, a bell, a person and an archive box in one
 * table row got nothing at all. The Properties row was the worst case: five
 * icons, no text, and the only way to find out what the bell did was to press
 * it and see what opened.
 *
 * That is a worse failure than it looks. An unlabelled destructive icon —
 * Archive sits next to Edit on that row — is a button people avoid, or press
 * once and regret.
 *
 * ONE LABEL, BOTH JOBS
 *
 * `label` becomes the tooltip AND the `aria-label`, from the same string. The
 * two cannot drift, which is the actual failure mode of adding tooltips by
 * hand: somebody renames the visible text, the assistive text keeps the old
 * wording, and nothing catches it because neither is ever read by the person
 * making the change.
 *
 * `label` is required. There is deliberately no way to render this component
 * without one.
 *
 * WHERE THE PROVIDER COMES FROM
 *
 * `AppShell` mounts a single `TooltipProvider`, so every admin route is already
 * inside one — including dialogs, which portal out of the DOM but stay in the
 * React tree and keep the context. Nothing here needs its own provider, and
 * adding one per button would reset the shared open/close delay that makes a
 * row of icons feel like one control rather than five.
 */
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ButtonProps = ComponentPropsWithoutRef<typeof Button>;

export interface IconButtonProps extends Omit<ButtonProps, "size" | "aria-label" | "children"> {
  /** What the button does, in plain words. Becomes the tooltip and the aria-label. */
  label: string;
  /** The icon. */
  children: ReactNode;
  /** Which side the tooltip opens on. Defaults to the top. */
  side?: "top" | "right" | "bottom" | "left";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, side = "top", asChild, ...props },
  ref,
) {
  // `asChild` passes straight through. Several call sites wrap an anchor so an
  // external link still behaves like one, and Slot merges `aria-label` onto it.
  //
  // Spread conditionally rather than passing `asChild={asChild}`:
  // `exactOptionalPropertyTypes` is on, so an explicit `undefined` is not the
  // same as an absent prop and the compiler rejects it.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          size="icon"
          aria-label={label}
          {...(asChild === undefined ? {} : { asChild })}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
});
