import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Sticker } from "@/components/ui/Sticker";
import { Vinyl } from "./Vinyl";
import { catalogueNumber, sleeveInk, type SoftwareApp } from "./appMeta";

/* Printed paper: the same turbulence as the page's grain layer, standing
 * still, laid over the sleeve's colour. */
const PAPER =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* Ring wear: the round mark a record leaves in its sleeve after years on a
 * shelf. Off-centre, the way the record sits against the open side. */
const RING_WEAR =
  "radial-gradient(circle at 56% 50%, transparent 0 40%, rgba(255,255,255,0.13) 40.5% 41.5%, transparent 42% 46%, rgba(0,0,0,0.10) 46.5% 47.5%, transparent 48%)";

type Props = {
  app: SoftwareApp;
  /** Position on the shelf: the catalogue number and the sticker's tilt. */
  index: number;
  /** On the deck: the sleeve is empty, and says so. */
  onDeck: boolean;
  /** Hands over the record as it stands right now — the deck flies it from there. */
  onPick: (id: string, record: DOMRect | null) => void;
};

/**
 * One app as a record sleeve. The cover is the name set large in the app's
 * colour — there is no screenshot to put on it, and an honest cover is all
 * type. The record is inside: a mouse over the sleeve draws it halfway out,
 * a click sends it to the deck at the top of the page, where its notes are.
 * While it is there the sleeve stays empty.
 *
 * The slot is a size query (`@container`), so the type, the ring and the
 * sticker scale with the sleeve from the phone's three-across to the
 * desktop's row of six. Hover only engages on hover-capable pointers.
 */
export function Sleeve({ app, index, onDeck, onPick }: Props) {
  const t = useTranslations("software");
  const recordRef = useRef<HTMLSpanElement>(null);
  const words = app.name.split(/\s+/);
  const nameLast = index % 2 === 0;

  return (
    <button
      type="button"
      aria-pressed={onDeck}
      onClick={() => onPick(app.id, recordRef.current?.getBoundingClientRect() ?? null)}
      className="group relative block w-full rounded-[4px] text-left hover:z-10 focus-visible:z-10"
    >
      <span data-sleeve-slot={app.id} className="@container relative block aspect-square">
        {onDeck ? null : (
          <span
            ref={recordRef}
            data-sleeve-record
            className="absolute inset-[3%] transition-[translate,rotate] duration-500 ease-out group-hover:translate-x-[38%] group-hover:rotate-[50deg] group-focus-visible:translate-x-[38%] group-focus-visible:rotate-[50deg]"
          >
            <Vinyl app={app} />
          </span>
        )}

        <span
          aria-hidden
          className={`absolute inset-0 flex overflow-hidden rounded-[4px] p-[9%] text-[#fbf6ea] shadow-card transition-[translate] duration-500 ease-out ${
            nameLast ? "flex-col" : "flex-col-reverse"
          } justify-between group-hover:-translate-x-[3%] group-focus-visible:-translate-x-[3%]`}
          style={{ background: `${RING_WEAR}, ${sleeveInk(app.hue)}` }}
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
            style={{ backgroundImage: PAPER }}
          />
          <span className="relative font-mono text-[6cqw] uppercase leading-none tracking-[0.14em] opacity-80">
            FHF · {catalogueNumber(index)}
          </span>
          <span
            lang="en"
            className="relative font-serif text-[15.5cqw] font-normal italic leading-[0.92] tracking-[-0.02em] [overflow-wrap:anywhere]"
          >
            {words.map((word, i) => (
              <span key={i} className="block">
                {word}
              </span>
            ))}
          </span>
        </span>

        {app.version ? (
          <Sticker seed={index} border={2} className="absolute -right-[5%] -top-[5%] z-10">
            <span className="flex size-[27cqw] items-center justify-center rounded-full bg-[#f4ecdc] font-mono text-[5cqw] font-semibold tracking-[-0.02em] text-[#4a3413]">
              {app.version}
            </span>
          </Sticker>
        ) : null}
      </span>

      <span className="mt-3 block min-w-0">
        <span lang="en" className="block truncate text-[0.95rem] font-semibold text-fg">
          {app.name}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-caption text-fg-secondary">
          {app.tagline}
        </span>
        <span
          className={`mt-1.5 block font-mono text-meta uppercase tracking-meta ${
            onDeck ? "text-accent" : "text-fg-tertiary"
          }`}
        >
          {onDeck ? `● ${t("onDeck")}` : t(`categories.${app.category}`)}
        </span>
      </span>
    </button>
  );
}
