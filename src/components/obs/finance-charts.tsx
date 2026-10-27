import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { niceDate, php } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Finance charts. Every one is a single measure, so they take one hue
 * (--viz-series) and no legend: the title names the measure. Values sit in
 * text ink beside the marks, and every mark has a hover with the exact figure.
 */
const SERIES = "var(--viz-series)";

export function ChartCard({ title, figure, sub, children, className }: { title: string; figure?: ReactNode; sub?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/70 bg-surface shadow-level-2", className)}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="malaya-eyebrow">{title}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          {figure && <p className="font-display text-xl tabular-nums">{figure}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const compact = (n: number) => (Math.abs(n) >= 1000 ? `₱${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `₱${n}`);

function DayTip({ active, payload }: { active?: boolean; payload?: { payload: { d: string; collected: number; expenses: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-xs shadow-level-3">
      <p className="font-medium">{niceDate(p.d, { weekday: "short", month: "short", day: "numeric" })}</p>
      <p className="mt-1 tabular-nums">Collected <span className="font-semibold">{php(p.collected)}</span></p>
      {Number(p.expenses) > 0 && <p className="tabular-nums text-muted-foreground">Spent {php(p.expenses)}</p>}
    </div>
  );
}

/** Money in by day: one bar per day, the day's total on hover. */
export function DailyBars({ data }: { data: { d: string; collected: number; expenses: number }[] }) {
  const rows = data.map((r) => ({ ...r, collected: Number(r.collected), expenses: Number(r.expenses), label: String(Number(r.d.slice(8))) }));
  const many = rows.length > 16;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={many ? "preserveStartEnd" : 0} minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={compact} />
          <Tooltip content={<DayTip />} cursor={{ fill: "var(--secondary)" }} />
          <Bar dataKey="collected" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={many ? 14 : 28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A ranked list as horizontal bars: label, bar, value. Bars share one scale. */
export function HBars({ items, format = php, empty = "Nothing in this period." }: { items: { label: string; value: number; hint?: string }[]; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => Number(i.value)));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(Number(i.value))}${i.hint ? ` · ${i.hint}` : ""}`} className="group grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground group-hover:text-foreground">{i.label}</span>
          <span className="h-2.5 rounded-full bg-secondary">
            <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, (Number(i.value) / max) * 100)}%`, background: SERIES }} />
          </span>
          <span className="tabular-nums">{format(Number(i.value))}</span>
        </li>
      ))}
    </ul>
  );
}
