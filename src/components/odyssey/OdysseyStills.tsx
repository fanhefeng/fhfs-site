import Image from "next/image";
import { Reveal } from "@/components/fx/Reveal";
import type { OdysseySpan, OdysseyStill } from "./stills";

export type StillItem = OdysseyStill & { title: string; meta: string; alt: string };

/** How much of the six-column wall a print takes; two columns under md, one on a phone. */
const SPAN: Record<OdysseySpan, string> = {
  one: "md:col-span-2",
  tall: "md:col-span-2",
  wide: "sm:col-span-2 md:col-span-4",
  full: "sm:col-span-2 md:col-span-6",
};

/** Every still is 16:9; the upright and the panoramic crops only happen on the wide grid. */
const RATIO: Record<OdysseySpan, string> = {
  one: "aspect-video",
  tall: "aspect-video md:aspect-[5/6]",
  wide: "aspect-video",
  full: "aspect-video md:aspect-[21/9]",
};

const SIZES: Record<OdysseySpan, string> = {
  one: "(min-width: 1040px) 330px, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
  tall: "(min-width: 1040px) 330px, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
  wide: "(min-width: 1040px) 680px, (min-width: 768px) 66vw, 100vw",
  full: "(min-width: 1040px) 1040px, 100vw",
};

/**
 * The stills, hung on a six-column wall the way the neon study hangs its
 * prints — a wide one with an upright crop beside it, rows of three, and a
 * panoramic one across the bottom — but on paper: no mat, no rim, the same
 * rounded card every other picture on the site sits in. Under each, what the
 * frame is and which of the two films it comes from.
 */
export function OdysseyStills({ stills }: { stills: StillItem[] }) {
  return (
    <Reveal as="ul" stagger={0.06} className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-6 md:gap-6">
      {stills.map((still, i) => (
        <li key={still.id} className={`min-w-0 ${SPAN[still.span]}`}>
          <figure className="m-0">
            <Image
              src={`/odyssey/${still.file}.jpg`}
              width={still.width}
              height={still.height}
              alt={still.alt}
              sizes={SIZES[still.span]}
              // The first two are above the fold on a phone.
              fetchPriority={i < 2 ? "high" : undefined}
              className={`w-full rounded-card bg-surface object-cover ${RATIO[still.span]}`}
              style={still.focus ? { objectPosition: still.focus } : undefined}
            />
            <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="text-caption text-fg">{still.title}</span>
              <span className="font-mono text-[0.6875rem] uppercase tracking-meta text-fg-tertiary">{still.meta}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </Reveal>
  );
}
