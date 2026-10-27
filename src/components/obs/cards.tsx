import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "@/components/icons";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { signedPct } from "@/lib/format";
import { Card, CardContent } from "../ui/card";

export function SectionHeading({
  eyebrow,
  title,
  action,
  icon: Icon,
}: {
  eyebrow?: string | undefined;
  title: string;
  action?: ReactNode | undefined;
  /** A tile beside the title — Settings uses the same icon as the tab. */
  icon?: LucideIcon | undefined;
}) {
  // `flex-wrap`: on a phone the action drops under the title when the two
  // don't fit side by side. Kept on one line, Forecast's three range buttons
  // and Marketing's "Manage Flash Sale Settings" ran past the screen and the
  // whole page could be dragged sideways.
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div>
          {eyebrow && <p className="malaya-eyebrow">{eyebrow}</p>}
          <h2 className="font-display text-lg text-foreground sm:text-xl">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * `to` makes the whole card a link to the screen that owns the figure.
 *
 * Owner, 2026-09-07: "dashboard card breakdown goes to finance tab when
 * clicked". The Dashboard is a set of summaries of numbers computed elsewhere,
 * and the natural question at every one of them is "made of what" — which used
 * to mean finding the right tab in the sidebar by hand. `SnapshotCard` already
 * worked this way; the KPI row above it did not.
 *
 * The link WRAPS the card rather than sitting inside it as an "Open" affordance,
 * because a KPI card has no body to compete with — the whole tile is the target.
 */
export function KpiCard({
  label,
  value,
  sub,
  changePct,
  invertChange = false,
  to,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  changePct?: number | undefined;
  invertChange?: boolean | undefined;
  to?: string | undefined;
}) {
  const positive =
    changePct === undefined ? undefined : invertChange ? changePct <= 0 : changePct >= 0;
  const Arrow =
    changePct === undefined ? ArrowRight : changePct >= 0 ? ArrowUpRight : ArrowDownRight;

  const card = (
    <Card
      className={cn(
        "malaya-lift relative h-full overflow-hidden border-border/70 bg-surface shadow-level-2",
        to && "transition-colors hover:border-primary/40",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-primary/5 blur-2xl" />
      <CardContent className="relative flex flex-col gap-2 p-5">
        <p className="malaya-eyebrow">{label}</p>
        <p className="font-display text-[26px] leading-tight text-foreground sm:text-[28px]">
          {value}
        </p>
        <div className="flex items-center gap-2 text-xs">
          {changePct !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              <Arrow className="size-3" />
              {signedPct(changePct)}
            </span>
          )}
          {sub && <span className="truncate text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );

  if (!to) return card;

  return (
    <Link to={to} className="block h-full focus-visible:outline-none">
      {card}
    </Link>
  );
}

export function SnapshotCard({
  title,
  eyebrow,
  to,
  children,
  footer,
  className,
}: {
  title: string;
  eyebrow?: string | undefined;
  to?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  className?: string | undefined;
}) {
  // No `h-full`. A grid already stretches its cells to the row, so side-by-side
  // cards still match; `h-full` only added harm, in a stacked column
  // (`space-y-4` inside a grid cell) where it made EVERY card as tall as the
  // whole stack, and on a phone the stack spilled over the cards below it.
  return (
    <Card
      className={cn(
        "malaya-lift flex min-w-0 flex-col border-border/70 bg-surface shadow-level-2",
        className,
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="malaya-eyebrow">{eyebrow}</p>}
            <h3 className="font-display text-base text-foreground sm:text-lg">{title}</h3>
          </div>
          {to && (
            <Link
              to={to}
              className="link-action inline-flex items-center gap-1 text-xs font-semibold"
            >
              Open <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
        {/* min-w-0 so a long line inside can truncate instead of stretching the
            card past the screen on a phone. */}
        <div className="min-w-0 flex-1">{children}</div>
        {footer && (
          <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatRow({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean | undefined;
  tone?: "positive" | "negative" | "muted" | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <span
        className={cn("text-sm text-muted-foreground", emphasis && "font-semibold text-foreground")}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          emphasis ? "font-display text-base text-foreground" : "text-foreground/85",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "critical" | "warning" | "ok" | undefined;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5 shadow-level-1">
      <div className="min-w-0">
        <p className="font-display text-xl leading-tight text-foreground">
          <span
            className={cn(
              tone === "critical" && "text-destructive",
              tone === "warning" && "text-warning",
              tone === "ok" && "text-success",
            )}
          >
            {value}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
