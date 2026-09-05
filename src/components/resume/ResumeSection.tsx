import type { ReactNode } from "react";
import { Reveal } from "@/components/fx/Reveal";
import { Rich } from "./Rich";

/**
 * One section of the résumé: a numbered mono label in a rail on the left,
 * the content on the right. The rail is what makes the page scan as a
 * résumé rather than an essay — every section is found by its label before
 * it is read — and on a wide screen the label stays put while its section
 * scrolls past, so a reader in the middle of the jobs still knows where
 * they are. Narrow screens and paper stack the two — on A4 the rail would
 * be a third of the sheet left blank.
 */
export function ResumeSection({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Reveal
      as="section"
      className="mt-12 grid gap-x-10 gap-y-4 border-t border-line pt-8 sm:grid-cols-[8.5rem_1fr] print:mt-4 print:grid-cols-1 print:gap-y-2 print:pt-2"
    >
      <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary sm:sticky sm:top-28 sm:self-start print:static">
        <span className="text-accent">{index}</span>
        <span className="ml-3">{title}</span>
      </h2>
      <div className="min-w-0">{children}</div>
    </Reveal>
  );
}

/**
 * The résumé's list: a short hairline for a marker rather than a disc, hung
 * in the margin so the text keeps one left edge. Lines carry inline
 * emphasis (see Rich).
 */
export function Bullets({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={`space-y-2.5 text-body text-fg-secondary print:space-y-1 ${className}`}>
      {items.map((item, i) => (
        <li
          key={i}
          className="relative pl-5 before:absolute before:left-0 before:top-[0.85em] before:h-px before:w-2.5 before:bg-fg-tertiary print:break-inside-avoid"
        >
          <Rich text={item} />
        </li>
      ))}
    </ul>
  );
}
