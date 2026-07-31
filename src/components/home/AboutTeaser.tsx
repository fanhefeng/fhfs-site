import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";
import { Magnetic } from "@/components/fx/Magnetic";

type Props = {
  title: string;
  lead1: string;
  lead2: string;
  linkLabel: string;
};

/**
 * The closing note: two lines about the person, then the door to /about.
 * Last section of the issue, so it stays as quiet as the footer that follows.
 */
export function AboutTeaser({ title, lead1, lead2, linkLabel }: Props) {
  return (
    <Reveal as="section" className="border-t border-line pt-8">
      <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        {title}
      </h2>
      <p className="mt-5 text-body">{lead1}</p>
      <p className="mt-2 text-body text-fg-secondary">{lead2}</p>
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
