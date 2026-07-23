import { ArtDecoDivider } from "./ArtDecoDivider";

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-12 text-center">
      <h1 className="font-deco text-3xl tracking-[0.15em] text-gold [text-shadow:var(--glow-gold)] md:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-3 text-sm text-muted-fg">{subtitle}</p>}
      <ArtDecoDivider className="mt-5" />
    </div>
  );
}
