import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { getPosts, getApps } from "@/lib/content";
import { NeonSign } from "@/components/fx/NeonSign";
import { MarqueeLights } from "@/components/fx/MarqueeLights";
import { CinematicLoader } from "@/components/fx/CinematicLoader";
import { Starfield } from "@/components/fx/Starfield";
import { Magnetic } from "@/components/fx/Magnetic";
import { NoteTrail } from "@/components/fx/NoteTrail";
import { PosterWall } from "@/components/home/PosterWall";
import { Atmosphere } from "@/components/home/Atmosphere";
import { ClubWindow } from "@/components/home/ClubWindow";
import { NotesDeck, type DeckCard } from "@/components/home/NotesDeck";
import { PoemInterlude } from "@/components/home/PoemInterlude";
import { TourRoad, type TourStop } from "@/components/home/TourRoad";
import { AppsSlider, type SlideItem } from "@/components/home/AppsSlider";
import { PlanetStage } from "@/components/home/PlanetStage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates("", locale) };
}

/* The poem stays in its original Chinese on both locales — it is a work,
 * not UI copy. Source: the author's old notes repo (fanhefeng/fhf). */
const POEM_LINES = [
  "现代社会的数字僧侣",
  "日夜敲打着神秘咒语",
  "祈求 bug 神灵的宽恕",
  "他们用咖啡因驱动大脑",
  "用披萨填充胃部",
  "在键盘上编织着虚拟世界的经纬",
  "既是创造者",
  "也是被创造物奴役的奴隶",
];
const POEM_FINALE = ["创造", "压榨", "异化"];

/* The road here — real stops from the author's 2023 portfolio. City names
 * stay in Chinese in both locales (they are typography, not UI copy); only
 * the notes are translated. */
const TOUR_STOPS = [
  {
    city: "河津",
    latin: "HEJIN",
    year: "1990",
    note: { zh: "出生在黄河边的小城", en: "Born by the Yellow River" },
  },
  {
    city: "太原",
    latin: "TAIYUAN",
    year: "2009",
    note: { zh: "大学四年", en: "Four years of university" },
  },
  {
    city: "无锡",
    latin: "WUXI",
    year: "2013",
    note: { zh: "步入社会的第一站", en: "First stop of working life" },
  },
  {
    city: "北京",
    latin: "BEIJING",
    year: "",
    note: { zh: "在最大的舞台看了看", en: "A look at the biggest stage" },
  },
  {
    city: "青岛",
    latin: "QINGDAO",
    year: "",
    note: { zh: "在海边安顿下来", en: "Settled by the sea" },
  },
  {
    city: "今夜",
    latin: "TONIGHT",
    year: "2026",
    note: { zh: "深夜小馆，开张营业", en: "The after-hours club opens" },
  },
] as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const ts = await getTranslations("software");

  const deckCards: DeckCard[] = getPosts(locale as Locale)
    .slice(0, 6)
    .map((post) => ({
      title: post.title,
      href: `/blog/${post.slug}`,
      tags: post.tags,
      date: post.date.slice(0, 10).replaceAll("-", "."),
      summary: post.summary,
    }));

  const tourStops: TourStop[] = TOUR_STOPS.map((stop) => ({
    city: stop.city,
    latin: stop.latin,
    year: stop.year,
    note: stop.note[locale as Locale],
  }));

  const slides: SlideItem[] = getApps().map((app) => ({
    name: app.name,
    tagline: app.tagline[locale as Locale],
    category: ts(`categories.${app.category}`),
    href: app.website,
  }));

  return (
    <main className="flex-1">
      <Atmosphere />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.author,
          url: site.url,
          sameAs: [site.social.github],
        }}
      />

      {/* Overture — cinematic loader, first visit per session only */}
      <CinematicLoader word={site.signName} hint={t("loaderHint")} />

      {/* TRACK 01 — the neon sign stage, under a slow three.js starfield */}
      <section data-act="street" className="relative overflow-hidden">
        <Starfield className="opacity-80" />
        <NeonSign
          welcome={t("welcome")}
          name={site.signName}
          tagline={t("tagline")}
          skipLabel={tc("skipAnimation")}
        >
          <MarqueeLights className="neon-rest" />
          <p className="neon-rest max-w-md text-sm leading-relaxed text-muted-fg">
            {t("intro")}
          </p>
          {/* Magnetic CTA: the button leans toward the cursor and snaps
              back with an elastic release. */}
          <Magnetic className="neon-rest mt-4">
            <Link
              href="/blog"
              className="block rounded border border-neon-red/50 px-6 py-2.5 text-sm text-neon-red transition-all duration-200 hover:border-neon-red hover:[box-shadow:0_0_16px_rgba(255,77,109,0.35)] hover:[text-shadow:var(--glow-red)]"
            >
              {t("enter")}
            </Link>
          </Magnetic>
        </NeonSign>
        {/* Pointer trail: fast cursor sweeps shed falling neon notes. */}
        <NoteTrail />
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
          <span className="font-mono text-[10px] tracking-[0.22em] text-muted-fg">
            {t("scrollCue")}
          </span>
          <span className="mx-auto mt-2 block h-9 w-px bg-gradient-to-b from-gold/70 to-transparent" />
        </div>
        {/* Editorial margin notes — static set dressing, deliberately off-axis
            to break the perfect symmetry of the hero. No animation. */}
        <span className="pointer-events-none absolute left-5 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] tracking-[0.3em] text-muted-fg/80 [writing-mode:vertical-rl] md:block">
          {t("heroSideNote")}
        </span>
        <div className="pointer-events-none absolute bottom-20 right-6 hidden -rotate-1 border border-line px-2.5 py-1.5 text-right font-mono text-[10px] leading-relaxed text-muted-fg/80 md:block">
          <span className="block tracking-[0.24em]">EST. 2023</span>
          <span className="block tracking-[0.1em]">{t("heroPlaque")}</span>
        </div>
      </section>

      {/* TRACK 01½ — walking in: the camera pushes through the club window */}
      <ClubWindow
        kicker={t("trackWalkIn")}
        titleLines={[t("windowTitle1"), t("windowTitle2")]}
        lede={t("windowLede")}
        insideTitle={t("windowInsideTitle")}
        insideBody={t("windowInsideBody")}
        readoutLabel={t("windowReadout")}
      />

      {/* TRACK 02 — the set list: notes dealt as a 3D deck, scroll-driven */}
      <NotesDeck
        cards={deckCards}
        kicker={t("trackNotes")}
        heading={t("notesHeading")}
        subline={t("notesSub")}
      />
      {/* Setlist-style footnote link — a programme line, not a button */}
      <div className="mx-auto flex w-full max-w-md items-center gap-4 px-6 pb-6">
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/30"
        />
        <Link
          href="/blog"
          className="whitespace-nowrap font-mono text-[11px] tracking-[0.28em] text-muted-fg transition-all hover:text-gold hover:[text-shadow:var(--glow-gold)]"
        >
          {t("viewAllNotes")}
        </Link>
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30"
        />
      </div>

      {/* TRACK 03 — interlude: a poem, revealed line by line from the dark */}
      <PoemInterlude
        kicker={t("trackPoem")}
        title={t("poemTitle")}
        lines={POEM_LINES}
        finale={POEM_FINALE}
        attribution={t("poemAttribution")}
      />

      {/* TRACK 03½ — on tour: the road here, vertical scroll driving a
          pinned horizontal tour route, GSAP-homepage style */}
      <TourRoad
        kicker={t("trackTour")}
        heading={t("tourHeading")}
        marquee={t("tourMarquee")}
        stops={tourStops}
        walkHint={t("tourWalkHint")}
      />

      {/* TRACK 04 — works on the bar: seamless infinite drag slider */}
      <AppsSlider
        items={slides}
        kicker={t("trackWorks")}
        heading={t("worksHeading")}
        hint={t("sliderHint")}
        visitLabel={t("sliderVisit")}
      />
      {/* Menu-style footnote link, same programme treatment as above */}
      <div className="mx-auto flex w-full max-w-md items-center gap-4 px-6 pb-6">
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/30"
        />
        <Link
          href="/software"
          className="whitespace-nowrap font-mono text-[11px] tracking-[0.28em] text-muted-fg transition-all hover:text-gold hover:[text-shadow:var(--glow-gold)]"
        >
          {t("viewAllWorks")}
        </Link>
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30"
        />
      </div>

      {/* TRACK 04½ — the wall: scattered gig posters Flip into a grid,
          then the mains switch lights them up one by one. */}
      <PosterWall
        kicker={t("trackWall")}
        heading={t("wallHeading")}
        switchLabel={t("wallSwitch")}
        hint={t("wallHint")}
      />

      {/* ENCORE — the stylized planet from the 2023 portfolio, on its own
          full stage before the ASCII finale takes over. */}
      <PlanetStage
        kicker={t("trackEncore")}
        heading={t("encoreHeading")}
        line={t("encoreLine")}
        hint={t("encoreHint")}
      />
    </main>
  );
}
