"use client";

import { asset } from "@/lib/asset";
import dynamic from "next/dynamic";
import type { LabSlug } from "./entries";
import { LENS_SLIDES } from "./lensSlides";
// The neon sign hangs the La La Land room's stills — same files, same
// captions, read straight off that room's fixture list.
import { LALA_STILLS } from "@/components/films/lalaStills";
import { filmEntry } from "@/components/films/entries";
import { KOBE_PHOTOS } from "@/components/idols/kobePhotos";
import type { ChangelogEntry } from "@/components/about/Changelog";
import { DeskFallback, SceneGate, StageFallback } from "./SceneGate";

/**
 * One study per route, and only that study's code.
 *
 * Importing every demo statically and picking one at render time is fine for
 * React and useless for the bundler: a Server Component's client imports all
 * land in the route's chunk group whatever the branches say, so
 * /lab/melting-text would ship three.js. `next/dynamic`
 * with `ssr: false` (hence this client wrapper) gives each study its own
 * chunk, fetched when its route is opened. The canvas-driven demos lose
 * nothing to the missing SSR pass beyond the copy inside them — and that copy
 * is repeated in the page's own header. The DOM-first ones keep SSR, so the
 * page reads whole before the chunk lands.
 *
 * What `ssr: false` does cost is the room: until the chunk lands the study is
 * nothing at all, so the notes under it sit where the stage will be and get
 * shoved a screen down when it arrives. Each of these holds its place open
 * with a blank of about the size its first screen takes.
 *
 * The three.js studies (dissolve, grove, the desk) are rendered inside a
 * `SceneGate`, which asks Save-Data and WebGL before the element exists — and
 * so before the chunk is fetched. The lens slider asks inside its own chunk
 * instead: without WebGL it still works as a plain slider, and it keeps
 * three.js in a chunk of its own that it only fetches on a yes.
 */
const stageHold = () => <div aria-hidden="true" className="min-h-svh" />;
const deskHold = () => <div aria-hidden="true" className="h-[360px] md:h-[460px]" />;

const ScrollVideoDemo = dynamic(() => import("./ScrollVideoDemo").then((m) => m.ScrollVideoDemo), {
  ssr: false,
  loading: stageHold,
});
const DissolveDemo = dynamic(() => import("./DissolveDemo").then((m) => m.DissolveDemo), {
  ssr: false,
  loading: stageHold,
});
const MeltingTextDemo = dynamic(() => import("./MeltingTextDemo").then((m) => m.MeltingTextDemo), {
  ssr: false,
  loading: stageHold,
});
const GroveDemo = dynamic(() => import("./GroveDemo").then((m) => m.GroveDemo), {
  ssr: false,
  loading: stageHold,
});
const LiquidMetalDemo = dynamic(() => import("./LiquidMetalDemo").then((m) => m.LiquidMetalDemo), {
  ssr: false,
  loading: stageHold,
});
const Workstation = dynamic(
  () => import("@/components/about/Workstation").then((m) => m.Workstation),
  { ssr: false, loading: deskHold },
);
const LensSliderDemo = dynamic(() => import("./LensSliderDemo").then((m) => m.LensSliderDemo), {
  ssr: false,
  loading: stageHold,
});
// The one study that is DOM through and through — a canvas for the bricks,
// but the sign is SVG — so it keeps its SSR pass: the page reads whole
// before its chunk lands, and the wall paints over.
const NeonSignDemo = dynamic(() => import("./NeonSignDemo").then((m) => m.NeonSignDemo));

/* ---- the site's own effects: text in the DOM, GSAP over it ---- */
const SidewaysDemo = dynamic(() => import("./SidewaysDemo").then((m) => m.SidewaysDemo));
const MastheadDemo = dynamic(() => import("./MastheadDemo").then((m) => m.MastheadDemo));
const RevealDemo = dynamic(() => import("./RevealDemo").then((m) => m.RevealDemo));
const HeadlineDemo = dynamic(() => import("./HeadlineDemo").then((m) => m.HeadlineDemo));
const UnmaskDemo = dynamic(() => import("./UnmaskDemo").then((m) => m.UnmaskDemo));
const MagneticDemo = dynamic(() => import("./MagneticDemo").then((m) => m.MagneticDemo));
const GlintDemo = dynamic(() => import("./GlintDemo").then((m) => m.GlintDemo));
const DieCutDemo = dynamic(() => import("./DieCutDemo").then((m) => m.DieCutDemo));
const StickerWallDemo = dynamic(() => import("./StickerWallDemo").then((m) => m.StickerWallDemo));
const PeelDemo = dynamic(() => import("./PeelDemo").then((m) => m.PeelDemo));
const ScatterDemo = dynamic(() => import("./ScatterDemo").then((m) => m.ScatterDemo));
const DotNameDemo = dynamic(() => import("./DotNameDemo").then((m) => m.DotNameDemo));
const SegmentedDemo = dynamic(() => import("./SegmentedDemo").then((m) => m.SegmentedDemo));
const ReshuffleDemo = dynamic(() => import("./ReshuffleDemo").then((m) => m.ReshuffleDemo));
// The stage inside decides for itself whether three.js is ever fetched, so
// the study around it keeps its SSR pass like the rest of these.
const StatueDemo = dynamic(() => import("./StatueDemo").then((m) => m.StatueDemo));
// The shell, one piece per study.
const LightsDemo = dynamic(() => import("./LightsDemo").then((m) => m.LightsDemo));
const ReadingChipDemo = dynamic(() => import("./ReadingChipDemo").then((m) => m.ReadingChipDemo));
const RadialFanDemo = dynamic(() => import("./RadialFanDemo").then((m) => m.RadialFanDemo));
const OvertureDemo = dynamic(() => import("./OvertureDemo").then((m) => m.OvertureDemo));
const DoorDemo = dynamic(() => import("./DoorDemo").then((m) => m.DoorDemo));
const VeilDemo = dynamic(() => import("./VeilDemo").then((m) => m.VeilDemo));
const IslandDemo = dynamic(() => import("./IslandDemo").then((m) => m.IslandDemo));
// The cover's approach, the changelog and the screening room are the site's
// components mounted as they are — no demo wrapper to write.
const GroveApproach = dynamic(
  () => import("@/components/grove/GroveApproach").then((m) => m.GroveApproach),
  { ssr: false, loading: stageHold },
);
const Changelog = dynamic(() => import("@/components/about/Changelog").then((m) => m.Changelog));
const FilmStills = dynamic(() => import("@/components/films/FilmStills").then((m) => m.FilmStills));

/** Every string a study can ask for, already translated by the page. */
export type StudyText = Record<string, string>;

type Props = {
  slug: LabSlug;
  accent: string;
  text: StudyText;
  /** The changelog study's rows — the real ones, localized by the page. */
  entries?: ChangelogEntry[];
};

export function LabStudy({ slug, accent, text, entries }: Props) {
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
          failed={s("failed")}
        />
      );
    case "dissolve":
      return (
        <SceneGate
          hold={stageHold()}
          fallback={(why) => (
            <StageFallback
              accent={accent}
              image={asset("/lab/dissolve/forest.jpg")}
              backdrop="#16211a"
              headline={s("headline")}
              body={s("body")}
              tail={s("tail")}
              note={s(why === "save-data" ? "saveData" : "fallback")}
            />
          )}
        >
          <DissolveDemo
            accent={accent}
            hint={s("hint")}
            headline={s("headline")}
            body={s("body")}
            tail={s("tail")}
            fallbackNote={s("fallback")}
          />
        </SceneGate>
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
        <SceneGate
          hold={stageHold()}
          fallback={(why) => (
            <StageFallback
              accent={accent}
              image={asset("/grove/moss-plate.webp")}
              backdrop="#4a4d44"
              headline={s("headline")}
              body={s("body")}
              tail={s("tail")}
              note={s(why === "save-data" ? "saveData" : "fallback")}
            />
          )}
        >
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
        </SceneGate>
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
      return (
        <SceneGate
          hold={deskHold()}
          fallback={(why) => (
            <DeskFallback note={s(why === "save-data" ? "deskSaveData" : "deskFallback")} />
          )}
        >
          <Workstation
            hint={s("deskHint")}
            turnLeft={s("turnLeft")}
            turnRight={s("turnRight")}
            fallbackNote={s("deskFallback")}
            className="mx-auto w-full max-w-5xl px-6"
          />
        </SceneGate>
      );
    case "lens-slider":
      return (
        <LensSliderDemo
          accent={accent}
          hint={s("hint")}
          fallbackNote={s("fallback")}
          saveDataNote={s("saveData")}
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
          galleryKicker={s("galleryKicker")}
          galleryTitle={s("galleryTitle")}
          galleryLede={s("galleryLede")}
          stillsCredit={s("stillsCredit")}
          credit={s("credit")}
          stills={LALA_STILLS.map((still) => ({
            src: asset(`/films/lala/${still.file}.jpg`),
            width: still.width,
            height: still.height,
            span: still.span,
            focus: still.focus,
            alt: s(`${still.id}Alt`),
            title: s(`${still.id}Title`),
            meta: s(`${still.id}Meta`),
          }))}
        />
      );

    /* ---- the site's own effects ---- */
    case "sideways":
      return (
        <SidewaysDemo
          accent={accent}
          hint={s("hint")}
          lead={s("lead")}
          lineOne={s("lineOne")}
          lineTwo={s("lineTwo")}
          lineThree={s("lineThree")}
          tail={s("tail")}
        />
      );
    case "masthead":
      return (
        <MastheadDemo
          accent={accent}
          label={s("label")}
          replay={s("replay")}
          lineOne={s("lineOne")}
          lineTwo={s("lineTwo")}
        />
      );
    case "reveal":
      return (
        <RevealDemo
          accent={accent}
          label={s("label")}
          replay={s("replay")}
          items={[s("itemOne"), s("itemTwo"), s("itemThree"), s("itemFour"), s("itemFive")]}
        />
      );
    case "headline":
      return (
        <HeadlineDemo accent={accent} label={s("label")} replay={s("replay")} title={s("title")} />
      );
    case "unmask":
      return (
        <UnmaskDemo accent={accent} label={s("label")} replay={s("replay")} title={s("title")} />
      );
    case "magnetic":
      return (
        <MagneticDemo
          accent={accent}
          label={s("label")}
          weak={s("weak")}
          medium={s("medium")}
          strong={s("strong")}
          reachNote={s("reachNote")}
          touchNote={s("touchNote")}
        />
      );
    case "glint":
      return (
        <GlintDemo
          accent={accent}
          label={s("label")}
          cardKicker={s("cardKicker")}
          cardTitle={s("cardTitle")}
          cardBody={s("cardBody")}
          touchNote={s("touchNote")}
        />
      );
    case "die-cut":
      return <DieCutDemo accent={accent} label={s("label")} sample={s("sample")} />;
    case "sticker-wall":
      return (
        <StickerWallDemo
          accent={accent}
          label={s("label")}
          title={s("wallTitle")}
          hint={s("wallHint")}
          ariaLabel={s("wallAria")}
        />
      );
    case "peel":
      return (
        <PeelDemo
          accent={accent}
          label={s("label")}
          hint={s("peelHint")}
          ariaLabel={s("peelAria")}
          secret={s("secret")}
        />
      );
    case "scatter":
      return (
        <ScatterDemo
          accent={accent}
          label={s("label")}
          hint={s("pointerHint")}
          text={s("text")}
          touchNote={s("touchNote")}
        />
      );
    case "dot-name":
      return (
        <DotNameDemo
          accent={accent}
          label={s("label")}
          hint={s("pointerHint")}
          text={s("text")}
          touchNote={s("touchNote")}
        />
      );
    case "approach":
      return (
        <GroveApproach
          kicker={s("kicker")}
          title={s("title")}
          link={{ label: s("linkLabel"), href: s("linkHref") }}
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
    case "segmented":
      return (
        <SegmentedDemo
          accent={accent}
          label={s("label")}
          ariaLabel={s("ariaLabel")}
          all={s("all")}
          writing={s("writing")}
          software={s("software")}
          lab={s("lab")}
          selected={s("selected")}
          keyNote={s("keyNote")}
        />
      );
    case "reshuffle":
      return (
        <ReshuffleDemo
          accent={accent}
          label={s("label")}
          lede={s("lede")}
          filterName={s("filterName")}
          ariaLabel={s("ariaLabel")}
          all={s("all")}
          round={s("round")}
          square={s("square")}
          line={s("line")}
          motionName={s("motionName")}
          motionAria={s("motionAria")}
          motionSite={s("motionSite")}
          motionSlow={s("motionSlow")}
          motionNone={s("motionNone")}
          readoutIdle={s("readoutIdle")}
          readout={s("readout")}
          readoutNone={s("readoutNone")}
          note={s("gridNote")}
        />
      );
    /* ---- the shell, one piece per study ---- */
    case "lights":
      return <LightsDemo accent={accent} label={s("label")} body={s("body")} />;
    case "reading-chip":
      return <ReadingChipDemo accent={accent} label={s("label")} body={s("body")} />;
    case "radial-fan":
      return (
        <RadialFanDemo
          accent={accent}
          label={s("label")}
          body={s("body")}
          shareTitle={s("shareTitle")}
        />
      );
    case "overture":
      return (
        <OvertureDemo
          accent={accent}
          label={s("label")}
          body={s("body")}
          action={s("action")}
          reducedNote={s("reducedNote")}
        />
      );
    case "door":
      return (
        <DoorDemo
          accent={accent}
          label={s("label")}
          body={s("body")}
          action={s("action")}
          homeHref={s("homeHref")}
        />
      );
    case "veil":
      return <VeilDemo accent={accent} label={s("label")} body={s("body")} action={s("action")} />;
    case "island":
      return <IslandDemo accent={accent} label={s("label")} body={s("body")} />;
    case "statue": {
      const cover = KOBE_PHOTOS[0]!;
      return (
        <StatueDemo
          accent={accent}
          label={s("label")}
          lede={s("lede")}
          viewName={s("viewName")}
          viewAria={s("viewAria")}
          viewBronze={s("viewBronze")}
          viewWire={s("viewWire")}
          frameLabel={s("frameLabel")}
          stateDrawing={s("stateDrawing")}
          stateIdle={s("stateIdle")}
          note={s("frameNote")}
          dragHint={s("dragHint")}
          loading={s("loading")}
          fallbackNote={s("fallback")}
          fallback={{
            src: asset(`/idols/kobe/${cover.file}`),
            width: cover.width,
            height: cover.height,
            alt: s("coverAlt"),
          }}
          turnLeft={s("turnLeft")}
          turnRight={s("turnRight")}
        />
      );
    }
    case "changelog":
      // An empty list would prerender as a study with nothing in it and no
      // error to notice; the page is the only thing that fills this in.
      if (!entries) throw new Error(`lab study "${slug}" needs entries, which the page never set`);
      return (
        <div className="mx-auto w-full max-w-[720px] px-6 pt-8">
          <Changelog entries={entries} title={s("title")} ariaLabel={s("ariaLabel")} railAlways />
        </div>
      );
    case "screening": {
      const film = filmEntry("odyssey")!;
      return (
        <div className="mx-auto w-full max-w-[1040px] px-6 pt-8">
          <FilmStills
            folder={film.slug}
            ratio={film.ratio}
            stills={film.stills.map((still) => ({
              ...still,
              title: s(`${still.id}Title`),
              meta: s(`${still.id}Meta`),
              alt: s(`${still.id}Alt`),
            }))}
            text={{
              open: s("open"),
              close: s("close"),
              prev: s("prev"),
              next: s("next"),
              counter: s("counter"),
              hint: s("viewerHint"),
            }}
          />
        </div>
      );
    }
  }
}
