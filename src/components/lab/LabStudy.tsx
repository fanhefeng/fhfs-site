"use client";

import { asset } from "@/lib/asset";
import dynamic from "next/dynamic";
import type { LabSlug } from "./entries";
import { LENS_SLIDES } from "./lensSlides";
import { NEON_STILLS } from "./neonStills";
// The album binds the stills the 大话西游 room already hangs — same files,
// same captions, read straight off that room's fixture list.
import { ODYSSEY_STILLS } from "@/components/films/odysseyStills";

/**
 * One study per route, and only that study's code.
 *
 * Importing every demo statically and picking one at render time is fine for
 * React and useless for the bundler: a Server Component's client imports all
 * land in the route's chunk group whatever the branches say, so
 * /lab/melting-text would ship three.js. `next/dynamic`
 * with `ssr: false` (hence this client wrapper) gives each study its own
 * chunk, fetched when its route is opened. The demos are all canvas-driven,
 * so there is nothing lost to the missing SSR pass beyond the copy inside
 * them — and that copy is repeated in the page's own header.
 */
const ScrollVideoDemo = dynamic(() => import("./ScrollVideoDemo").then((m) => m.ScrollVideoDemo), {
  ssr: false,
});
const DissolveDemo = dynamic(() => import("./DissolveDemo").then((m) => m.DissolveDemo), {
  ssr: false,
});
const MeltingTextDemo = dynamic(() => import("./MeltingTextDemo").then((m) => m.MeltingTextDemo), {
  ssr: false,
});
const GroveDemo = dynamic(() => import("./GroveDemo").then((m) => m.GroveDemo), {
  ssr: false,
});
const GroveStageDemo = dynamic(() => import("./GroveStageDemo").then((m) => m.GroveStageDemo), {
  ssr: false,
});
const LiquidMetalDemo = dynamic(() => import("./LiquidMetalDemo").then((m) => m.LiquidMetalDemo), {
  ssr: false,
});
const Workstation = dynamic(
  () => import("@/components/about/Workstation").then((m) => m.Workstation),
  { ssr: false },
);
const LensSliderDemo = dynamic(() => import("./LensSliderDemo").then((m) => m.LensSliderDemo), {
  ssr: false,
});
// The one study that is DOM through and through — a canvas for the bricks,
// but the sign is SVG — so it keeps its SSR pass: the page reads whole
// before its chunk lands, and the wall paints over.
const NeonSignDemo = dynamic(() => import("./NeonSignDemo").then((m) => m.NeonSignDemo));
// DOM and CSS 3D only, so it renders server-side and the stills are in the
// HTML whether or not the chunk ever lands.
const AlbumDemo = dynamic(() => import("./AlbumDemo").then((m) => m.AlbumDemo));

/** Every string a study can ask for, already translated by the page. */
export type StudyText = Record<string, string>;

type Props = {
  slug: LabSlug;
  accent: string;
  text: StudyText;
};

export function LabStudy({ slug, accent, text }: Props) {
  // The page fills `text` key by key from a list it keeps by hand. A key it
  // forgot used to arrive here as `undefined` and render as a blank; every
  // study is prerendered, so throwing turns that into a failed build instead.
  const s = (key: string): string => {
    const value = text[key];
    if (value === undefined)
      throw new Error(`lab study "${slug}" asks for text.${key}, which the page never set`);
    return value;
  };
  switch (slug) {
    case "scroll-video":
      return (
        <ScrollVideoDemo
          accent={accent}
          hint={s("hint")}
          loading={s("loading")}
          captionOne={s("captionOne")}
          captionOneBody={s("captionOneBody")}
          captionTwo={s("captionTwo")}
          captionTwoBody={s("captionTwoBody")}
        />
      );
    case "dissolve":
      return (
        <DissolveDemo
          accent={accent}
          hint={s("hint")}
          headline={s("headline")}
          body={s("body")}
          tail={s("tail")}
          fallbackNote={s("fallback")}
        />
      );
    case "melting-text":
      return (
        <MeltingTextDemo
          accent={accent}
          sampleOne={s("sampleOne")}
          sampleTwo={s("sampleTwo")}
          sampleThree={s("sampleThree")}
          labelLoad={s("labelLoad")}
          labelInView={s("labelInView")}
          labelScrub={s("labelScrub")}
        />
      );
    case "grove":
      return (
        <GroveDemo
          accent={accent}
          hint={s("hint")}
          headline={s("headline")}
          body={s("body")}
          tail={s("tail")}
          fallbackNote={s("fallback")}
          stageScan={s("stageScan")}
          stageGrow={s("stageGrow")}
          stageSettle={s("stageSettle")}
          dressLegend={s("dressLegend")}
          dressNames={text}
        />
      );
    case "album":
      return (
        <AlbumDemo
          accent={accent}
          hint={s("hint")}
          prevLabel={s("prev")}
          nextLabel={s("next")}
          counterAria={s("counterAria")}
          credit={s("credit")}
          plates={ODYSSEY_STILLS.map((still) => ({
            src: asset(`/films/odyssey/${still.file}.jpg`),
            width: still.width,
            height: still.height,
            alt: s(`${still.id}Alt`),
            title: s(`${still.id}Title`),
            meta: s(`${still.id}Meta`),
          }))}
        />
      );
    case "grove-stage":
      return (
        <GroveStageDemo
          accent={accent}
          hint={s("pointerHint")}
          fallbackNote={s("fallback")}
          cards={[
            {
              label: s("cardALabel"),
              title: s("cardATitle"),
              href: s("cardAHref"),
              src: asset("/grove/moss-plate.webp"),
              alt: s("cardAAlt"),
              linkLabel: s("cardALink"),
            },
            {
              label: s("cardBLabel"),
              title: s("cardBTitle"),
              href: s("cardBHref"),
              src: asset("/lab/dissolve/forest.jpg"),
              alt: s("cardBAlt"),
              linkLabel: s("cardBLink"),
            },
          ]}
        />
      );
    case "liquid-metal":
      return (
        <LiquidMetalDemo
          accent={accent}
          hint={s("hint")}
          headline={s("headline")}
          body={s("body")}
          tail={s("tail")}
          fallbackNote={s("fallback")}
          label={s("label")}
          stageField={s("stageField")}
          stageMolten={s("stageMolten")}
          stageBloom={s("stageBloom")}
        />
      );
    case "workstation":
      return <Workstation hint={s("deskHint")} className="mx-auto w-full max-w-5xl px-6" />;
    case "lens-slider":
      return (
        <LensSliderDemo
          accent={accent}
          hint={s("hint")}
          fallbackNote={s("fallback")}
          counterAria={s("counterAria")}
          prevLabel={s("prev")}
          nextLabel={s("next")}
          slides={LENS_SLIDES.map((name) => ({
            src: asset(`/lab/lens/${name}.jpg`),
            alt: s(`${name}Alt`),
            title: s(`${name}Title`),
            body: s(`${name}Body`),
            meta: s(`${name}Meta`),
          }))}
        />
      );
    case "neon":
      return (
        <NeonSignDemo
          welcome={s("welcome")}
          signOn={s("signOn")}
          signOff={s("signOff")}
          galleryKicker={s("galleryKicker")}
          galleryTitle={s("galleryTitle")}
          galleryLede={s("galleryLede")}
          credit={s("credit")}
          stills={NEON_STILLS.map((still) => ({
            src: asset(`/lab/neon/${still.file}.jpg`),
            width: still.width,
            height: still.height,
            span: still.span,
            alt: s(`${still.id}Alt`),
            title: s(`${still.id}Title`),
            meta: s(`${still.id}Meta`),
          }))}
        />
      );
  }
}
