import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PhotoTile } from "./chrome";

// Desktop tiles beside the cover, by how many there are: [col span, row span].
const SIDE: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [[2, 1], [2, 1]],
  3: [[2, 1], [1, 1], [1, 1]],
  4: [[1, 1], [1, 1], [1, 1], [1, 1]],
};

/**
 * The cottage page's photos, Malaya-style: a swipe row on a phone, the cover
 * plus up to four tiles on desktop. Any photo opens all of them full size.
 */
export function Gallery({ name, photos }: { name: string; photos: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length)
    return (
      <div className="grid gap-2.5 md:h-[300px] md:grid-cols-4 md:grid-rows-2">
        <PhotoTile name={name} className="aspect-[4/3] rounded-3xl md:col-span-2 md:row-span-2 md:aspect-auto" />
        {[0, 1, 2, 3].map((i) => <PhotoTile key={i} name={name} className="hidden rounded-3xl md:grid" />)}
      </div>
    );
  const side = photos.slice(1, 5);
  const tile = "h-full w-full cursor-zoom-in object-cover transition duration-300 hover:brightness-95";
  return (
    <>
      {/* Phone: swipe through every photo. */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 md:hidden">
        {photos.map((src, i) => (
          <button key={src} type="button" onClick={() => setOpen(i)} className="relative aspect-[4/3] w-[86%] shrink-0 snap-center overflow-hidden rounded-3xl">
            <img src={src} alt={`${name}, photo ${i + 1}`} loading={i ? "lazy" : "eager"} className={tile} />
            <span className="absolute bottom-3 right-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium shadow-level-1">{i + 1} / {photos.length}</span>
          </button>
        ))}
      </div>

      {/* Desktop: the cover and up to four more. */}
      <div className="relative hidden h-[360px] grid-cols-4 grid-rows-2 gap-2.5 md:grid">
        <button type="button" onClick={() => setOpen(0)} className={cn("overflow-hidden rounded-3xl", side.length ? "col-span-2 row-span-2" : "col-span-4 row-span-2")}>
          <img src={photos[0]} alt={name} className={tile} />
        </button>
        {side.map((src, i) => {
          const [c, r] = SIDE[side.length]![i]!;
          return (
            <button key={src} type="button" onClick={() => setOpen(i + 1)} className="overflow-hidden rounded-3xl" style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }}>
              <img src={src} alt={`${name}, photo ${i + 2}`} loading="lazy" className={tile} />
            </button>
          );
        })}
        {photos.length > 1 && (
          <button type="button" onClick={() => setOpen(0)} className="absolute bottom-4 right-4 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium shadow-level-2 hover:bg-secondary">
            Show all {photos.length} photos
          </button>
        )}
      </div>

      <Viewer name={name} photos={photos} at={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Every photo full width, scrolled to the one that was tapped. */
function Viewer({ name, photos, at, onClose }: { name: string; photos: string[]; at: number | null; onClose: () => void }) {
  const refs = useRef<(HTMLImageElement | null)[]>([]);
  useEffect(() => {
    if (!at) return; // the first photo: stay at the top, title in view
    const id = requestAnimationFrame(() => refs.current[at]?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(id);
  }, [at]);
  return (
    <Dialog open={at !== null} onOpenChange={(o) => !o && onClose()}>
      {/* Only the photos scroll, so the title and the close button stay put. */}
      <DialogContent className="flex max-h-[92dvh] max-w-[min(960px,calc(100vw-1.5rem))] flex-col gap-3 p-3 sm:p-5">
        <DialogTitle className="site-display px-1 pr-10 text-lg">{name} · {photos.length} photo{photos.length === 1 ? "" : "s"}</DialogTitle>
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-y-auto">
          {photos.map((src, i) => (
            <img key={src} ref={(el) => { refs.current[i] = el; }} src={src} alt={`${name}, photo ${i + 1}`} loading="lazy" className="w-full rounded-2xl bg-secondary" />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
