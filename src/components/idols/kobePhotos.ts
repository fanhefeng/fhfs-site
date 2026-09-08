/**
 * The photographs on the Kobe page, in the order they hang: twelve from
 * Wikimedia Commons, 2005 to 2024, each under its own licence. What is here
 * is provenance — file, size, who took it, under what terms, where on
 * Commons it came from — because that has to be right regardless of
 * language. The captions (`title` / `meta` / `alt`) are copy and live under
 * `idols.kobe.photos.<id>` in the message catalogues.
 *
 * Resized to 1600px on the long side and recompressed for the site
 * (`public/idols/kobe/`); the originals are linked from each `page`.
 */
export type KobePhoto = {
  id:
    | "hawaii8"
    | "hawaiiDunk"
    | "drives2007"
    | "dunk2008"
    | "beijing2008"
    | "parade2009"
    | "game2010"
    | "obama2010"
    | "london2012"
    | "stage2013"
    | "farewell2015"
    | "cabanyal2024";
  file: string;
  width: number;
  height: number;
  author: string;
  licence: string;
  /** The file's page on Commons — the licence terms and the original are there. */
  page: string;
};

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

export const KOBE_PHOTOS: KobePhoto[] = [
  {
    id: "hawaii8",
    file: "kobe-bryant-8.jpg",
    width: 1071,
    height: 1600,
    author: "Sgt. Joseph A. Lee, U.S. Marine Corps",
    licence: "Public domain",
    page: `${COMMONS}Kobe_Bryant_8.jpg`,
  },
  {
    id: "hawaiiDunk",
    file: "kobe-bryant-dunk.jpg",
    width: 1066,
    height: 1600,
    author: "Cpl. Megan Stiner, U.S. Marine Corps",
    licence: "Public domain",
    page: `${COMMONS}Kobe_Bryant_dunk.jpg`,
  },
  {
    id: "drives2007",
    file: "kobe-bryant-drives2.jpg",
    width: 1130,
    height: 1600,
    author: "Keith Allison",
    licence: "CC BY-SA 3.0",
    page: `${COMMONS}Kobe_Bryant_Drives2.jpg`,
  },
  {
    id: "dunk2008",
    file: "bryant-about-to-dunk-2008.jpg",
    width: 1121,
    height: 1600,
    author: "Keith Allison",
    licence: "CC BY-SA 2.0",
    page: `${COMMONS}Bryant_about_to_dunk_2008.jpg`,
  },
  {
    id: "beijing2008",
    file: "kobe-bryant-beijing-olympics-men-s-semifinal-basketball.jpg",
    width: 1066,
    height: 1600,
    author: "Richard Giles",
    licence: "CC BY-SA 2.0",
    page: `${COMMONS}Kobe_Bryant_Beijing_Olympics_Men%27s_Semifinal_Basketball.jpg`,
  },
  {
    id: "parade2009",
    file: "kobe-bryant-disney-parade.jpg",
    width: 1248,
    height: 1600,
    author: "LDCross",
    licence: "CC BY 2.0",
    page: `${COMMONS}Kobe_Bryant_Disney_Parade.jpg`,
  },
  {
    id: "game2010",
    file: "kobe-bryant-in-2010-1.jpg",
    width: 1600,
    height: 1200,
    author: "Bryan Horowitz",
    licence: "CC BY-SA 2.0",
    page: `${COMMONS}Kobe_Bryant_in_2010-1.jpg`,
  },
  {
    id: "obama2010",
    file: "2010-nba-champion-los-angeles-lakers-with-president-obama.jpg",
    width: 1600,
    height: 1066,
    author: "Lawrence Jackson, The White House",
    licence: "Public domain",
    page: `${COMMONS}2010_NBA_Champion_Los_Angeles_Lakers_with_President_Obama.jpg`,
  },
  {
    id: "london2012",
    file: "kobe-bryant-smiling-on-the-bench-usa-vs-gbr-2012.jpg",
    width: 1600,
    height: 1066,
    author: "Christopher Johnson",
    licence: "CC BY-SA 2.0",
    page: `${COMMONS}Kobe_Bryant_smiling_on_the_bench_USA_vs_GBR_2012.jpg`,
  },
  {
    id: "stage2013",
    file: "kobe-bryant-stage.jpg",
    width: 1307,
    height: 1600,
    author: "Neon Tommy",
    licence: "CC BY-SA 2.0",
    page: `${COMMONS}Kobe_Bryant_Stage.jpg`,
  },
  {
    id: "farewell2015",
    file: "kobe-bryant-2015.jpg",
    width: 1107,
    height: 1600,
    author: "Keith Allison",
    licence: "CC BY-SA 2.0",
    page: `${COMMONS}Kobe_Bryant_2015.jpg`,
  },
  {
    id: "cabanyal2024",
    file: "kobe-bryant-cabanyal-02.jpg",
    width: 1600,
    height: 1201,
    author: "Francesc Fort",
    licence: "CC0",
    page: `${COMMONS}Kobe_Bryant_-_Cabanyal_02.jpg`,
  },
];

/** The eleven milestones under the photographs, in order — copy under
 *  `idols.kobe.timeline.<id>`. */
export const KOBE_TIMELINE = [
  "born",
  "draft",
  "threepeat",
  "eightyone",
  "mvp",
  "backtoback",
  "farewell",
  "retired",
  "oscar",
  "gone",
  "statue",
] as const;
