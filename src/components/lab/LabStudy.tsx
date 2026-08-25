"use client";

import dynamic from "next/dynamic";
import type { LabSlug } from "./entries";

/**
 * One study per route, and only that study's code.
 *
 * The page used to import all six demos statically and pick one at render
 * time — which is fine for React and useless for the bundler: a Server
 * Component's client imports all land in the route's chunk group whatever
 * the branches say, so /lab/melting-text shipped three.js. `next/dynamic`
 * with `ssr: false` (hence this client wrapper) gives each study its own
 * chunk, fetched when its route is opened. The demos are all canvas-driven,
 * so there is nothing lost to the missing SSR pass beyond the copy inside
 * them — and that copy is repeated in the page's own header.
 */
const ScrollVideoDemo = dynamic(
  () => import("./ScrollVideoDemo").then((m) => m.ScrollVideoDemo),
  { ssr: false }
);
const DissolveDemo = dynamic(
  () => import("./DissolveDemo").then((m) => m.DissolveDemo),
  { ssr: false }
);
const MeltingTextDemo = dynamic(
  () => import("./MeltingTextDemo").then((m) => m.MeltingTextDemo),
  { ssr: false }
);
const GroveDemo = dynamic(() => import("./GroveDemo").then((m) => m.GroveDemo), {
  ssr: false,
});
const LiquidMetalDemo = dynamic(
  () => import("./LiquidMetalDemo").then((m) => m.LiquidMetalDemo),
  { ssr: false }
);
const Workstation = dynamic(
  () => import("@/components/about/Workstation").then((m) => m.Workstation),
  { ssr: false }
);

/** Every string a study can ask for, already translated by the page. */
export type StudyText = Record<string, string>;

type Props = {
  slug: LabSlug;
  accent: string;
  text: StudyText;
};

export function LabStudy({ slug, accent, text }: Props) {
  switch (slug) {
    case "scroll-video":
      return (
        <ScrollVideoDemo
          accent={accent}
          hint={text.hint}
          loading={text.loading}
          captionOne={text.captionOne}
          captionOneBody={text.captionOneBody}
          captionTwo={text.captionTwo}
          captionTwoBody={text.captionTwoBody}
        />
      );
    case "dissolve":
      return (
        <DissolveDemo
          accent={accent}
          hint={text.hint}
          headline={text.headline}
          body={text.body}
          tail={text.tail}
          fallbackNote={text.fallback}
        />
      );
    case "melting-text":
      return (
        <MeltingTextDemo
          accent={accent}
          sampleOne={text.sampleOne}
          sampleTwo={text.sampleTwo}
          sampleThree={text.sampleThree}
          labelLoad={text.labelLoad}
          labelInView={text.labelInView}
          labelScrub={text.labelScrub}
        />
      );
    case "grove":
      return (
        <GroveDemo
          accent={accent}
          hint={text.hint}
          headline={text.headline}
          body={text.body}
          tail={text.tail}
          fallbackNote={text.fallback}
          stageScan={text.stageScan}
          stageGrow={text.stageGrow}
          stageSettle={text.stageSettle}
        />
      );
    case "liquid-metal":
      return (
        <LiquidMetalDemo
          accent={accent}
          hint={text.hint}
          headline={text.headline}
          body={text.body}
          tail={text.tail}
          fallbackNote={text.fallback}
          label={text.label}
          stageField={text.stageField}
          stageMolten={text.stageMolten}
          stageBloom={text.stageBloom}
        />
      );
    case "workstation":
      return <Workstation hint={text.deskHint} className="mx-auto w-full max-w-5xl px-6" />;
  }
}
