import * as React from "react";

import { cn } from "@/lib/utils";

/** SSR has no layout to measure, and useLayoutEffect warns if asked to try. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/*
 * PINNED HEADERS (Clarence, 2026-10-22: "pin the headers of each tables ...
 * only while scrolling down").
 *
 * The header row is `position: sticky`, and sticky only works against the
 * nearest scroll box. This wrapper used to be `overflow-auto` on every table,
 * which made it that scroll box. The wrapper never scrolls up and down, so
 * the header had nothing to stick to. Now the wrapper only becomes a
 * sideways scroller when the table really is wider than it. Otherwise it is
 * `overflow-visible`, and the header pins to the admin's content panel as
 * the page scrolls. A table too wide for the screen keeps its sideways
 * scroll and doesn't pin.
 *
 * Laptop up only (`lg:`): below that the admin's top bar is sticky too, and
 * most tables turn into cards on a phone anyway.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const wrapRef = React.useRef<HTMLDivElement>(null);
    // Scrollable until measured, as before: a too-wide table must never
    // spill out of its card, even for one frame.
    const [wide, setWide] = React.useState(true);
    useIsomorphicLayoutEffect(() => {
      const wrap = wrapRef.current;
      const table = wrap?.firstElementChild as HTMLElement | null;
      if (!wrap || !table) return;
      const check = () => setWide(table.offsetWidth > wrap.clientWidth + 1);
      check();
      const observer = new ResizeObserver(check);
      observer.observe(wrap);
      observer.observe(table);
      return () => observer.disconnect();
    }, []);
    return (
      <div
        ref={wrapRef}
        className={cn("relative w-full", wide ? "overflow-x-auto" : "overflow-visible")}
      >
        <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      // Opaque, so rows don't show through the header while it is pinned
      // (the cells' own fill is a see-through tint). The 1px line, drawn on
      // the cells because a <thead> shadow isn't painted everywhere, keeps an
      // edge under it once rows are scrolling beneath.
      "[&_tr]:border-b-0 [&_tr]:hover:bg-transparent lg:sticky lg:top-0 lg:z-10 lg:bg-card lg:[&_th]:shadow-[inset_0_-1px_0_var(--border)]",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/50 transition-colors hover:bg-secondary/50 data-[state=selected]:bg-secondary",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 bg-secondary/60 px-3 first:pl-5 last:pr-5 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3 py-3 first:pl-5 last:pr-5 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
