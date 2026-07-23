import { Link } from "@/i18n/navigation";

export function TagPill({ tag }: { tag: string }) {
  return (
    <Link
      href={`/blog/tags/${encodeURIComponent(tag)}`}
      className="rounded-full border border-neon-blue/30 px-2.5 py-0.5 text-xs text-neon-blue transition-all duration-200 hover:border-neon-blue/70 hover:[text-shadow:var(--glow-blue)]"
    >
      {tag}
    </Link>
  );
}
