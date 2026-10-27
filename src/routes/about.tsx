import { createFileRoute } from "@tanstack/react-router";
import { Car, ExternalLink, MapPin, Phone } from "@/components/icons";
import { PublicShell } from "@/components/public/chrome";
import { Button } from "@/components/ui/button";
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
          <h1 className="site-display mx-auto max-w-3xl text-3xl leading-tight sm:text-5xl">{s?.resort_name}</h1>
          <p className="mt-3 text-muted-foreground">{s?.tagline}</p>
          {s?.address && <p className="mt-2 text-sm text-muted-foreground"><MapPin className="mr-1 inline size-4 align-[-3px]" />{s.address}</p>}
        </div>
        {s?.map_lat && s.map_lng && <GettingHere lat={Number(s.map_lat)} lng={Number(s.map_lng)} address={s.address} phone={s.whatsapp_number} />}
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

/** The resort's pin on Google Maps, with one-tap directions in Google Maps or Waze. */
function GettingHere({ lat, lng, address, phone }: { lat: number; lng: number; address: string; phone: string }) {
  const at = `${lat},${lng}`;
  return (
    <Card id="map" className="scroll-mt-24 overflow-clip rounded-3xl border-border/70 shadow-level-1">
      <iframe
        title="Map to the resort"
        src={`https://maps.google.com/maps?q=${at}&z=14&output=embed`}
        className="block h-72 w-full border-0 sm:h-96"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <CardContent className="space-y-4 p-6 sm:p-8">
        <div>
          <h2 className="site-display text-2xl">Getting here</h2>
          {address && <p className="mt-1 text-sm text-muted-foreground">{address}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${at}`} target="_blank" rel="noreferrer"><Car className="size-4" /> Directions</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`https://waze.com/ul?ll=${at}&navigate=yes`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open in Waze</a>
          </Button>
          {phone && (
            <Button asChild variant="outline">
              <a href={`tel:${phone.replace(/\s/g, "")}`}><Phone className="size-4" /> {phone}</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
