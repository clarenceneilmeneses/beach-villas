import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "@/components/icons";
import { PublicShell } from "@/components/public/chrome";
import { Card, CardContent } from "@/components/ui/card";
import { slotTimes, useSettings } from "@/lib/data";
import { php } from "@/lib/format";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  const s = useSettings().data;
  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] space-y-6 px-4 pt-10 sm:px-8">
        <div className="text-center">
          <h1 className="site-display text-4xl sm:text-5xl">About {s?.resort_name}</h1>
          <p className="mt-3 text-muted-foreground">{s?.tagline}</p>
          {s?.address && <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" /> {s.address}</p>}
        </div>
        <Card className="rounded-3xl border-border/70 shadow-level-1">
          <CardContent className="space-y-3 p-6 sm:p-8">
            <h2 className="site-display text-2xl">Stay times</h2>
            <p className="text-sm">Day tour: {slotTimes(s, "day")}</p>
            <p className="text-sm">Overnight: {slotTimes(s, "night")}</p>
            <p className="text-sm">22 hours: {slotTimes(s, "h22")}</p>
            <p className="text-sm text-muted-foreground">Entrance: {php(s?.entrance_adult)} per adult, {php(s?.entrance_child)} per child.</p>
          </CardContent>
        </Card>
        <Card id="policy" className="scroll-mt-24 rounded-3xl border-border/70 shadow-level-1">
          <CardContent className="space-y-3 p-6 sm:p-8">
            <h2 className="site-display text-2xl">Booking policy</h2>
            <p className="text-sm text-muted-foreground">A downpayment confirms your booking once our staff verify it. The rest is settled at the resort. If you don't arrive, the downpayment is kept. The resort's own policy will be written here.</p>
          </CardContent>
        </Card>
        <Card id="rules" className="scroll-mt-24 rounded-3xl border-border/70 shadow-level-1">
          <CardContent className="space-y-3 p-6 sm:p-8">
            <h2 className="site-display text-2xl">House rules</h2>
            <p className="text-sm text-muted-foreground">The resort's house rules go here.</p>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
