import Image from "next/image";

export type GroveCardData = {
  /** Small grey line above the title — what kind of thing this is. */
  label: string;
  title: string;
  href: string;
  src: string;
  alt: string;
  /** Spoken label for the knob, which is an icon on its own. */
  linkLabel: string;
};

type Props = GroveCardData & {
  /** `a` is the plate that the moss drapes over, `b` the one in front of it. */
  slot: "a" | "b";
};

const Sprout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21v-7" />
    <path d="M12 14c0-3.3 2.4-6 5.5-6 .3 3.6-2.2 6.4-5.5 6Z" />
    <path d="M12 16c-.1-2.9-2.2-5.2-4.9-5.2C6.8 13.7 9 16 12 16Z" />
  </svg>
);

/**
 * A card standing in the grove.
 *
 * Two of them, and the whole point is which side of the moss each is on: card
 * `a` paints under the canvas, so the root drapes over its shoulder, and card
 * `b` rides in front of it on a nearer parallax plane. That is the depth — a
 * card cannot be behind a photograph of a grove, only behind a grove that is
 * still being drawn.
 *
 * Each card carries its own knob, on the corner of its photograph. The first
 * version of this composition floated card a's knob out of the card so it
 * could sit *over* the trunk that covers the card's lower corner — and that is
 * exactly what read wrong: a control in front of the moss belonging to a sheet
 * behind it. Now the knob stays with its card, and the trunk is left to cross
 * the corner it does not sit on.
 */
export function GroveCard({ slot, label, title, href, src, alt, linkLabel }: Props) {
  const plate = (
    <figure className="ga-plate">
      <span className="ga-plate-media">
        {/* Deliberately not preloaded: the cards are a screen down and the
            first paper above them is the one that has to arrive fast. Lazy
            loading starts them as the pin comes into view, which is well
            before --ga-card lifts them off zero. */}
        <Image src={src} alt={alt} fill sizes="(max-width: 900px) 84vw, 22vw" />
      </span>
    </figure>
  );

  return (
    <article className={`ga-card ga-card--${slot}`}>
      {/* The lab card reads plate → label → title, the field note the other way
          up. Same frame, mirrored — which is also what keeps each card's
          photograph on the side of it the moss is not covering, and its knob
          on the photograph's outer corner. */}
      {slot === "a" && plate}
      <p className="ga-card-label">{label}</p>
      <p className="ga-card-title">{title}</p>
      {slot === "b" && plate}
      <a className="ga-knob" href={href} aria-label={linkLabel}>
        <Sprout />
      </a>
    </article>
  );
}
