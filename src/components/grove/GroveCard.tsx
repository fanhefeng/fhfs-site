import Image from "next/image";

/** What fills a card's window: a photograph, or a line of text. */
type Window =
  | { src: string; alt: string; note?: never }
  | {
      /** Text shown in the window as it was written — a line from the moments
       *  board, or what a lab study is — with the day or minute under it. */
      note: { text: string; stamp: string; lang?: string };
      src?: never;
      alt?: never;
    };

export type GroveCardData = {
  /** Small grey line above the title — what kind of thing this is. */
  label: string;
  /** Left out when the window says it all; the window then takes the room. */
  title?: string;
  href: string;
  /** The card's accessible name. The whole card is the link, and what it
   *  says out loud is where it goes, not everything printed on it. */
  linkLabel: string;
} & Window;

type Props = GroveCardData & {
  /** `a` is the plate that the moss drapes over, `b` the one in front of it. */
  slot: "a" | "b";
};

const Sprout = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
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
 * The whole card is the link. It used to be only the knob, a 54-unit circle on
 * a card five times its size, and a reader who clicked the title or the
 * picture got nothing. The knob stays as the card's mark of being a way in —
 * on the photograph's outer corner, the corner the trunk never reaches.
 */
export function GroveCard({ slot, label, title, href, linkLabel, ...view }: Props) {
  const plate = (
    <figure className={`ga-plate${view.note ? " ga-plate--note" : ""}`}>
      <span className="ga-plate-media">
        {view.note ? (
          <span className="ga-note" lang={view.note.lang}>
            <span className="ga-note-text">{view.note.text}</span>
            <span className="ga-note-stamp">{view.note.stamp}</span>
          </span>
        ) : (
          /* Deliberately not preloaded: the cards are a screen down and the
             first paper above them is the one that has to arrive fast. Lazy
             loading starts them as the pin comes into view, which is well
             before --ga-card lifts them off zero. */
          <Image src={view.src} alt={view.alt} fill sizes="(max-width: 900px) 84vw, 22vw" />
        )}
      </span>
    </figure>
  );

  return (
    <a className={`ga-card ga-card--${slot}`} href={href} aria-label={linkLabel}>
      {/* Card a reads plate → label → title, card b the other way up. Same
          frame, mirrored — which is also what keeps each card's window on the
          side of it the moss is not covering, and its knob on the window's
          outer corner. */}
      {slot === "a" && plate}
      <span className="ga-card-label">{label}</span>
      {title && <span className="ga-card-title">{title}</span>}
      {slot === "b" && plate}
      <span className="ga-knob" aria-hidden="true">
        <Sprout />
      </span>
    </a>
  );
}
