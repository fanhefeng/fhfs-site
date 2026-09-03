"use client";

import dynamic from "next/dynamic";
import type { LabSlug } from "./entries";
import { NEON_STILLS } from "./neonStills";

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
const GroveStageDemo = dynamic(
  () => import("./GroveStageDemo").then((m) => m.GroveStageDemo),
  { ssr: false }
);
const LiquidMetalDemo = dynamic(
  () => import("./LiquidMetalDemo").then((m) => m.LiquidMetalDemo),
  { ssr: false }
);
const Workstation = dynamic(
  () => import("@/components/about/Workstation").then((m) => m.Workstation),
  { ssr: false }
);
const LensSliderDemo = dynamic(
  () => import("./LensSliderDemo").then((m) => m.LensSliderDemo),
  { ssr: false }
);
// The one study that is DOM through and through — a canvas for the bricks,
// but the sign is SVG and the player an iframe — so it keeps its SSR pass:
// the page reads whole before its chunk lands, and the wall paints over.
const NeonSignDemo = dynamic(() => import("./NeonSignDemo").then((m) => m.NeonSignDemo));

/** The four photographs the lens slides between, in order. */
const LENS_SLIDES = ["river", "falls", "sea", "coffee"] as const;

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
    case "grove-stage":
      return (
        <GroveStageDemo
          accent={accent}
          hint={text.pointerHint}
          fallbackNote={text.fallback}
          cards={[
            {
              label: text.cardALabel,
              title: text.cardATitle,
              href: text.cardAHref,
              src: "/grove/moss-plate.webp",
              alt: text.cardAAlt,
              linkLabel: text.cardALink,
            },
            {
              label: text.cardBLabel,
              title: text.cardBTitle,
              href: text.cardBHref,
              src: "/lab/dissolve/forest.jpg",
              alt: text.cardBAlt,
              linkLabel: text.cardBLink,
            },
          ]}
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
    case "lens-slider":
      return (
        <LensSliderDemo
          accent={accent}
          hint={text.hint}
          fallbackNote={text.fallback}
          counterAria={text.counterAria}
          prevLabel={text.prev}
          nextLabel={text.next}
          slides={LENS_SLIDES.map((name) => ({
            src: `/lab/lens/${name}.jpg`,
            alt: text[`${name}Alt`],
            title: text[`${name}Title`],
            body: text[`${name}Body`],
            meta: text[`${name}Meta`],
          }))}
        />
      );
    case "neon":
      return (
        <NeonSignDemo
          welcome={text.welcome}
          signOn={text.signOn}
          signOff={text.signOff}
          toggleHint={text.toggleHint}
          tonight={text.tonight}
          trackTitle={text.trackTitle}
          trackArtist={text.trackArtist}
          fallbackTrackArtist={text.fallbackTrackArtist}
          fallbackHint={text.fallbackHint}
          playerTitle={text.playerTitle}
          galleryKicker={text.galleryKicker}
          galleryTitle={text.galleryTitle}
          galleryLede={text.galleryLede}
          credit={text.credit}
          stills={NEON_STILLS.map((still) => ({
            src: `/lab/neon/${still.file}.jpg`,
            width: still.width,
            height: still.height,
            span: still.span,
            alt: text[`${still.id}Alt`],
            title: text[`${still.id}Title`],
            meta: text[`${still.id}Meta`],
          }))}
        />
      );
  }
}
