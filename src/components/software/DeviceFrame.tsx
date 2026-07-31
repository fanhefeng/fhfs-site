import type { ReactNode } from "react";

type Props = {
  device: "mac" | "iphone";
  children: ReactNode;
  className?: string;
};

/**
 * Glass wireframe hardware, drawn entirely in CSS — no device mockup images,
 * no extra bytes. The frame is `glass-thin` (a container material) and the
 * screen inside is opaque, so this never becomes glass stacked on glass.
 *
 * Purely presentational: SSR-safe, no client directive, no motion of its own.
 */
export function DeviceFrame({ device, children, className }: Props) {
  if (device === "iphone") {
    return (
      <div className={className}>
        <div className="glass-thin rounded-[2.1rem] p-[3.5%]">
          <div className="relative aspect-[9/19] overflow-hidden rounded-[1.65rem] bg-surface">
            {children}
            {/* Dynamic-island pill, floating over the screen content. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[1.5%] h-[2.2%] w-[26%] -translate-x-1/2 rounded-full bg-black/70"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="glass-thin rounded-[0.9rem] p-[1.4%]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[0.45rem] bg-surface">
          {children}
        </div>
      </div>
      {/* Neck + foot. The neck is a trapezoid via a clip-path so the whole
       * stand is two elements and zero images. */}
      <span
        aria-hidden
        className="mx-auto block h-3 w-[15%] bg-line [clip-path:polygon(6%_0,94%_0,100%_100%,0_100%)]"
      />
      <span
        aria-hidden
        className="mx-auto block h-1.5 w-[32%] rounded-b-full bg-line"
      />
    </div>
  );
}
