/** Gold Art-Deco style divider used under section titles. */
export function ArtDecoDivider({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center gap-3 text-gold/70 ${className}`}
    >
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 0 L8.8 5.2 L14 7 L8.8 8.8 L7 14 L5.2 8.8 L0 7 L5.2 5.2 Z" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
}
