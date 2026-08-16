import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";
import { Magnetic } from "@/components/fx/Magnetic";

/** One changelog entry, resolved to plain strings by the page. */
export type NowItem = {
  key: string;
  /** "5.1" — the /about changelog's release number. */
  version: string;
  title: string;
  /** Pre-formatted, mono-friendly: "2026.07" or a date label. */
  date: string;
};

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
  lead1: string;
  lead2: string;
  linkLabel: string;
  /** The last three changelog entries — what "now" looks like. */
  nowItems: NowItem[];
  nowTitle: string;
  /** Marks the newest entry: "此刻" / "Now". */
  nowBadge: string;
  contactTitle: string;
  contacts: ContactLink[];
};

/**
 * The closing note: two lines about the person, then the door to /about —
 * and, for the reader who only ever sees the cover, the short version of
 * everything behind that door: the newest three changelog releases and the
 * places to find the author. Last section of the issue, so it stays as quiet
 * as the footer that follows.
 */
export function AboutTeaser({
  title,
  index,
  lead1,
  lead2,
  linkLabel,
  nowItems,
  nowTitle,
  nowBadge,
  contactTitle,
  contacts,
}: Props) {
  return (
    <Reveal as="section" className="border-t border-line pt-8">
      <h2 className="flex items-baseline gap-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        {index ? <span aria-hidden="true">№ {index}</span> : null}
        {title}
      </h2>
      <p className="mt-5 text-body">{lead1}</p>
      <p className="mt-2 text-body text-fg-secondary">{lead2}</p>

      {nowItems.length > 0 ? (
        <div className="mt-8">
          <h3 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {nowTitle}
          </h3>
          <ul className="mt-3">
            {nowItems.map((item, i) => (
              <li
                key={item.key}
                className="flex items-baseline gap-3 border-b border-line py-2.5 last:border-b-0 sm:gap-4"
              >
                <span
                  className={`w-8 shrink-0 font-mono text-meta tabular-nums ${
                    i === 0 ? "text-accent" : "text-fg-tertiary"
                  }`}
                >
                  {item.version}
                </span>
                <span className="min-w-0 flex-1 truncate text-caption text-fg-secondary">
                  {item.title}
                </span>
                {i === 0 ? (
                  <span className="shrink-0 font-mono text-meta uppercase tracking-meta text-accent">
                    {nowBadge}
                  </span>
                ) : null}
                <span className="shrink-0 font-mono text-meta tabular-nums text-fg-tertiary">
                  {item.date}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contacts.length > 0 ? (
        <div className="mt-7 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <h3 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {contactTitle}
          </h3>
          {contacts.map((contact) => (
            <a
              key={contact.href}
              href={contact.href}
              {...(contact.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
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
    </Reveal>
  );
}
