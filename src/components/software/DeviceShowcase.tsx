"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP } from "@/lib/gsap";
import { SegmentedFilter, type Segment } from "./SegmentedFilter";
import { DeviceFrame } from "./DeviceFrame";
import { AppMock } from "./AppMock";
import type { SoftwareApp } from "./appMeta";

/**
 * "On the screen" — one Mac and one iPhone wireframe, and a segmented control
 * that changes channel between the six apps (work-journey.sunebear.com's TV
 * dial, in Apple clothing). Switching cross-fades the two screens together so
 * the hardware never blinks; the schematics inside keep following the gallery
 * lights on their own (AppMock), which is why this component owns no theme
 * state at all.
 */
export function DeviceShowcase({ apps }: { apps: SoftwareApp[] }) {
  const t = useTranslations("software");
  const [id, setId] = useState(apps[0]?.id ?? "");
  const screensRef = useRef<HTMLDivElement>(null);

  const options = useMemo<Segment[]>(
    () => apps.map((a) => ({ value: a.id, label: a.name })),
    [apps]
  );
  const current = apps.find((a) => a.id === id) ?? apps[0];

  useGSAP(
    () => {
      const root = screensRef.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Channel change: the new schematic dissolves in place. No layout is
        // touched, so this stays a compositor-only 0.35s.
        gsap.fromTo(
          root.querySelectorAll("[data-screen]"),
          { autoAlpha: 0, scale: 1.015 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.35,
            ease: "power2.out",
            overwrite: "auto",
            clearProps: "transform,opacity,visibility",
          }
        );
      });
    },
    { dependencies: [id], scope: screensRef, revertOnUpdate: true }
  );

  if (!current) return null;

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <SegmentedFilter
          options={options}
          value={current.id}
          onChange={setId}
          ariaLabel={t("deviceAria")}
        />
      </div>

      <div
        ref={screensRef}
        className="flex flex-col items-center gap-10 sm:flex-row sm:items-end sm:justify-center sm:gap-8"
      >
        <DeviceFrame device="mac" className="w-full sm:max-w-xl sm:flex-1">
          <div data-screen className="absolute inset-0">
            <AppMock
              key={`mac-${current.id}`}
              app={current}
              label={t("mockAlt", { name: current.name })}
              className="absolute inset-0"
            />
          </div>
        </DeviceFrame>
        <DeviceFrame device="iphone" className="w-36 shrink-0 sm:w-40">
          <div data-screen className="absolute inset-0">
            <AppMock
              key={`phone-${current.id}`}
              app={current}
              chrome="bare"
              label={t("mockAlt", { name: current.name })}
              className="absolute inset-0"
            />
          </div>
        </DeviceFrame>
      </div>
    </div>
  );
}
