import type { Ref } from "react";
import { appAccent, appMonogram, type SoftwareApp } from "./appMeta";

/* Fine grooves over black, a darker run-out band round the label and a
 * brighter lip at the edge. All rings, so the record looks the same at any
 * angle — what shows it turning is the label. */
const GROOVES = [
  "radial-gradient(circle, transparent 0 33%, rgba(0,0,0,0.55) 33.5% 36%, transparent 36.5%)",
  "radial-gradient(circle, transparent 0 96%, rgba(255,255,255,0.10) 97% 98.5%, transparent 99%)",
  "repeating-radial-gradient(circle, rgba(255,255,255,0.045) 0 1px, transparent 1px 3px)",
  "#121214",
].join(", ");

/* Light caught on the vinyl. It sits over the turning part and does not turn
 * itself: a reflection stays where the lamp is. Kept off the label. */
const SHEEN = {
  background:
    "conic-gradient(from 200deg, transparent 0deg, rgba(255,255,255,0.13) 22deg, transparent 52deg, transparent 180deg, rgba(255,255,255,0.08) 204deg, transparent 236deg)",
  mask: "radial-gradient(circle, transparent 0 34%, #000 35%)",
};

type Props = {
  app: SoftwareApp;
  /** The part that turns — the label and its print — for the deck to spin. */
  spinRef?: Ref<HTMLSpanElement>;
  className?: string;
};

/**
 * A record, drawn in CSS: no image, and the same drawing in the sleeve and on
 * the deck, so the one that flies between them never changes on the way. Its
 * own size query (`@container`) scales the label's print with the record.
 */
export function Vinyl({ app, spinRef, className }: Props) {
  return (
    <span
      aria-hidden
      className={`@container relative block aspect-square rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${className ?? ""}`}
      style={{ background: GROOVES }}
    >
      <span ref={spinRef} className="absolute inset-0 rounded-full">
        <span
          className="absolute inset-[32%] flex flex-col items-center justify-center rounded-full text-white"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${appAccent(app.hue, "dark")}, ${appAccent(app.hue, "light")} 70%)`,
          }}
        >
          <span className="font-mono text-[6.5cqw] font-semibold leading-none tracking-[0.04em]">
            {appMonogram(app.name)}
          </span>
          <span className="mt-[1.5cqw] font-mono text-[2.6cqw] leading-none tracking-[0.12em] opacity-80">
            33⅓
          </span>
        </span>
      </span>
      <span className="absolute inset-0 rounded-full" style={SHEEN} />
      {/* The spindle hole. */}
      <span className="absolute left-1/2 top-1/2 size-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d9d6cf] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" />
    </span>
  );
}
