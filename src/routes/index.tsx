import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "@/components/icons";
import { ErrorState } from "@/components/obs/states";
import { PhotoTile, PublicShell } from "@/components/public/chrome";
import { SearchPill, stayParams, withDefaults, type StaySearch } from "@/components/public/search-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { photosOf, useCottageTypes, useSettings, type CottageType } from "@/lib/data";
import { niceDate, php, SLOT_LABEL } from "@/lib/format";
import { rpc } from "@/lib/supabase";

export const Route = createFileRoute("/")({ validateSearch: stayParams, component: Home });

function Home() {
  const stay = withDefaults(Route.useSearch());
  const navigate = useNavigate();
  const settings = useSettings().data;
  const types = useCottageTypes();
  const avail = useQuery({
    queryKey: ["availability", stay.date],
    queryFn: () => rpc<{ type_id: string; slot: string; free: number }[]>("type_availability", { p_date: stay.date }),
  });

  return (
    <PublicShell explore>
      <section className="px-4 pb-8 pt-3 text-center sm:px-8 md:pb-14 md:pt-20">
        <p className="site-display hidden text-[11px] tracking-[0.5em] text-muted-foreground sm:text-sm md:block">{settings?.address || "By the beach"}</p>
        <h1 className="site-display mx-auto mt-4 hidden max-w-4xl text-4xl leading-[1.02] sm:text-6xl md:block lg:text-7xl">Book your day by the beach</h1>
        <p className="site-display mx-auto mt-5 hidden max-w-xl text-[11px] tracking-[0.35em] text-muted-foreground sm:text-sm md:block">{settings?.tagline}</p>
        <div className="mx-auto max-w-3xl md:mt-12">
          <SearchPill key={JSON.stringify(stay)} value={stay} onSearch={(v) => navigate({ to: "/", search: v, hash: "cottages" })} />
        </div>
      </section>

      <section id="cottages" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 sm:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="malaya-eyebrow">{niceDate(stay.date, { weekday: "long", month: "long", day: "numeric" })} · {SLOT_LABEL[stay.slot]}</p>
            <h2 className="site-display text-2xl sm:text-3xl">Our cottages</h2>
          </div>
          <p className="text-sm text-muted-foreground">Entrance {php(settings?.entrance_adult)} adult · {php(settings?.entrance_child)} child</p>
        </div>
        {types.error ? (
          <ErrorState error={types.error} />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3">
            {types.isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-3xl" />)
              : types.data?.map((t) => <CottageCard key={t.id} t={t} stay={stay} free={avail.data?.find((a) => a.type_id === t.id && a.slot === stay.slot)?.free} />)}
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function CottageCard({ t, stay, free }: { t: CottageType; stay: StaySearch; free: number | undefined }) {
  const rate = stay.slot === "day" ? t.rate_day : stay.slot === "night" ? t.rate_night : t.rate_h22;
  const full = free === 0;
  return (
    <Link to="/cottages/$typeId" params={{ typeId: t.id }} search={stay} className="group block">
      <div className="relative">
        <PhotoTile name={t.name} src={photosOf(t)[0]} className="aspect-square w-full rounded-3xl transition-transform duration-300 group-hover:scale-[1.01] lg:aspect-[4/3]" />
        {free !== undefined && (
          <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-xs font-medium shadow-level-1">
            {full ? "Full on this date" : `${free} free`}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-0.5 px-1">
        <h3 className="site-display text-base sm:text-lg">{t.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="size-4" /> {t.pax_included} included · up to {t.max_pax}</p>
        <p className="pt-1 text-sm"><span className="font-semibold">{php(rate)}</span> <span className="text-muted-foreground">/ {SLOT_LABEL[stay.slot].toLowerCase()}</span></p>
      </div>
    </Link>
  );
}
