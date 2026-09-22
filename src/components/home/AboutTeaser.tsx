import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";
import { Magnetic } from "@/components/fx/Magnetic";
import { Chibi } from "@/components/chibi/Chibi";

/** A place the author can be found — GitHub, RSS, mail. */
export type ContactLink = {
  label: string;
  href: string;
  /** External links open in a new tab; file routes and mailto don't need to. */
  external?: boolean;
};

type Props = {
  title: string;
  /** Section number in the issue's running order — "03". */
  index?: string;
  lead: string;
  linkLabel: string;
  contactTitle: string;
  contacts: ContactLink[];
  /** The chibi's accessible name and the line under it. */
  chibi: { label: string; hint: string };
};

/**
 * The closing note: one line about the person, the places to find them, and
 * the door to /about — beside the person themself, drawn, who looks back.
 * Last section of the issue, so the words stay as quiet as the footer that
 * follows; the chibi is the one thing here that moves.
 */
export function AboutTeaser({
  title,
  index,
  lead,
  linkLabel,
  contactTitle,
  contacts,
  chibi,
}: Props) {
  return (
    <Reveal
      as="section"
      className="flex flex-col gap-8 border-t border-line pt-8 sm:flex-row sm:items-center sm:gap-12"
    >
      <div className="w-40 shrink-0 self-center sm:order-last sm:w-52">
        <Chibi label={chibi.label} hint={chibi.hint} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-baseline gap-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {index ? <span aria-hidden="true">№ {index}</span> : null}
          {title}
        </h2>
        <p className="mt-5 text-body">{lead}</p>

        {contacts.length > 0 ? (
          <div className="mt-7 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <h3 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {contactTitle}
            </h3>
            {contacts.map((contact) => (
              <a
                key={contact.href}
                href={contact.href}
                {...(contact.external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="hit-ext font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors hover:text-accent"
              >
                {contact.label}
                <span aria-hidden="true"> ↗</span>
              </a>
            ))}
          </div>
        ) : null}

        <Magnetic className="mt-7">
          <Link
            href="/about"
            className="inline-flex h-11 items-center gap-2 text-caption font-medium text-fg underline decoration-accent/60 decoration-1 underline-offset-4 transition-colors hover:text-accent"
          >
            {linkLabel}
            <span aria-hidden="true">→</span>
          </Link>
        </Magnetic>
      </div>
    </Reveal>
  );
}
