import { asc } from "drizzle-orm";
import { db } from "@/db";
import { films } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth/session";
import { FILM_FACTS } from "@/lib/films";
import { TRACK_IDS } from "@/lib/tracks";
import zh from "../../../../messages/zh.json";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../ui/RecordList";
import { deleteFilm, saveFilm } from "../actions/films";
import type { Field, RecordData } from "../ui/RecordForm";
import { Note } from "../ui/Note";

const EMPTY = { zh: "", en: "" };

/** The facts strip's labels, as the page prints them. */
const FACT_LABELS: Record<(typeof FILM_FACTS)[number], string> = zh.films.facts;

const FIELDS: Field[] = [
  {
    name: "key",
    label: "key（网址 /films/…）",
    kind: "text",
    readOnly: true,
    placeholder: "odyssey",
    hint: "存下来就不能改：它是这部片子的网址。",
  },
  { name: "title", label: "片名", kind: "localized" },
  {
    name: "draft",
    label: "草稿",
    kind: "select",
    options: ["no", "yes"],
    hint: "yes 的时候只有后台的「在站上看」看得到，挂好了再改成 no。",
  },
  {
    name: "kicker",
    label: "片名上面那行小字",
    kind: "localized",
    hint: "比如「大话西游 · 1995」。",
  },
  {
    name: "latin",
    label: "另一种文字的片名",
    kind: "localized",
    hint: "中文页写英文名，英文页写原名，印在片名下面那行的开头。",
  },
  { name: "meta", label: "片名下面那行", kind: "localized", hint: "导演 · 主演 · 年份。" },
  {
    name: "subtitle",
    label: "一句话",
    kind: "localized",
    hint: "索引卡上片名下面那句，也是搜索引擎看到的描述。",
  },
  { name: "lede", label: "导语", kind: "localizedArea" },

  { name: "year", label: "年份", kind: "text", placeholder: "1995", group: "样子与排序" },
  {
    name: "track",
    label: "进门放的唱片",
    kind: "select",
    options: [
      { value: "", label: "不放", hint: "进门不换歌" },
      ...TRACK_IDS.map((id) => ({
        value: id,
        label: `${id} · ${zh.tracks[id].title}`,
        hint: zh.tracks[id].artist,
      })),
    ],
    hint: "唱片是站里自己存的录音文件，新加一张要改代码（src/lib/tracks.ts）。",
    group: "样子与排序",
  },
  {
    name: "ratio",
    label: "剧照的画幅",
    kind: "select",
    options: [
      { value: "video", label: "video · 16:9", hint: "从片子里截的帧" },
      { value: "photo", label: "photo · 3:2", hint: "剧照相机拍的照片" },
    ],
    hint: "墙上每张都裁成这个比例。",
    group: "样子与排序",
  },
  {
    name: "cover",
    label: "封面（剧照的 id）",
    kind: "text",
    hint: "/films 索引卡上那张。留空就用墙上第一张。",
    group: "样子与排序",
  },
  {
    name: "accent",
    label: "主色（hex）",
    kind: "text",
    placeholder: "#b8552e",
    hint: "只有排第一的那部用得到：/life 上电影那一行悬停时的色条。",
    group: "样子与排序",
  },
  { name: "sort", label: "排序", kind: "number", group: "样子与排序" },

  ...FILM_FACTS.map((fact): Field => ({
    name: `facts.${fact}`,
    label: FACT_LABELS[fact],
    kind: "localized",
    group: "资料（空着的那行不显示）",
  })),

  { name: "storyTitle", label: "标题", kind: "localized", group: "简介" },
  { name: "story", label: "正文（一行一段）", kind: "lines", rows: 6, group: "简介" },

  { name: "partsKicker", label: "小标题", kind: "localized", group: "分部（分几部上映的才填）" },
  { name: "partsTitle", label: "标题", kind: "localized", group: "分部（分几部上映的才填）" },
  {
    name: "parts",
    label: "每一部",
    kind: "rows",
    group: "分部（分几部上映的才填）",
    rows: {
      noun: "部",
      blank: { meta: EMPTY, title: EMPTY, note: EMPTY },
      fields: [
        { name: "meta", label: "日期 · 上 / 下部", kind: "localized" },
        { name: "title", label: "片名", kind: "localized" },
        { name: "note", label: "一段话", kind: "localizedArea" },
      ],
    },
  },

  { name: "linesTitle", label: "标题", kind: "localized", group: "台词" },
  {
    name: "lines",
    label: "每一句",
    kind: "rows",
    group: "台词",
    rows: {
      noun: "句",
      blank: { text: EMPTY, meta: EMPTY },
      fields: [
        { name: "text", label: "台词（不用加引号）", kind: "localizedArea" },
        { name: "meta", label: "谁说的 · 在哪", kind: "localized" },
      ],
    },
  },

  { name: "stillsKicker", label: "小标题", kind: "localized", group: "剧照墙" },
  { name: "stillsTitle", label: "标题", kind: "localized", group: "剧照墙" },
  { name: "stillsLede", label: "导语", kind: "localizedArea", group: "剧照墙" },
  {
    name: "stills",
    label: "每一张",
    kind: "rows",
    group: "剧照墙",
    hint: "上传会自动填好地址、宽高和 id；墙按这里的顺序挂，一行六格。",
    rows: {
      noun: "张",
      pictures: "films",
      blank: {
        id: "",
        src: "",
        width: "",
        height: "",
        span: "one",
        focus: "",
        title: EMPTY,
        meta: EMPTY,
        alt: EMPTY,
      },
      fields: [
        { name: "id", label: "id", kind: "text", mono: true },
        {
          name: "span",
          label: "占多宽",
          kind: "select",
          options: [
            { value: "one", label: "one · 一格", hint: "一行三张里的一张" },
            { value: "wide", label: "wide · 两格", hint: "宽的一张，旁边配一张 tall" },
            { value: "tall", label: "tall · 竖切", hint: "一格宽，桌面上裁成竖的" },
            { value: "full", label: "full · 通栏", hint: "整整一行，桌面上裁成宽银幕" },
          ],
        },
        { name: "width", label: "宽（像素）", kind: "number" },
        { name: "height", label: "高（像素）", kind: "number" },
        { name: "src", label: "地址", kind: "text", mono: true, wide: true },
        {
          name: "focus",
          label: "裁切对准（可空）",
          kind: "text",
          mono: true,
          placeholder: "24% 45%",
        },
        { name: "title", label: "标题", kind: "localized" },
        { name: "meta", label: "出自哪里", kind: "localized" },
        { name: "alt", label: "读屏：画面里是什么", kind: "localized" },
      ],
    },
  },
  { name: "credit", label: "页脚的版权说明", kind: "localizedArea", group: "剧照墙" },
];

export default async function FilmsAdminPage() {
  await requireAdminPage();
  const rows = await db.select().from(films).orderBy(asc(films.sort), asc(films.key));

  // Built per render: the default sort has to sit after whatever is there now.
  const blank: RecordData = {
    key: "",
    title: EMPTY,
    draft: "yes",
    kicker: EMPTY,
    latin: EMPTY,
    meta: EMPTY,
    subtitle: EMPTY,
    lede: EMPTY,
    year: "",
    track: "",
    ratio: "video",
    cover: "",
    accent: "",
    sort: (rows.at(-1)?.sort ?? -1) + 1,
    facts: Object.fromEntries(FILM_FACTS.map((fact) => [fact, EMPTY])),
    storyTitle: EMPTY,
    story: { zh: [], en: [] },
    partsKicker: EMPTY,
    partsTitle: EMPTY,
    parts: [],
    linesTitle: EMPTY,
    lines: [],
    stillsKicker: EMPTY,
    stillsTitle: EMPTY,
    stillsLede: EMPTY,
    stills: [],
    credit: EMPTY,
  };

  return (
    <AdminChrome title="电影" section="/admin/films">
      <Note>
        一部一页，/films/key。新的一部先存成草稿，在「在站上看」里看着挂好剧照，再把草稿改成 no。
      </Note>
      <RecordList
        action={saveFilm}
        deleteAction={deleteFilm}
        fields={FIELDS}
        unit="部"
        rows={rows.map((row) => ({
          id: row.key,
          label: row.title.zh || row.title.en,
          meta: row.draft ? `${row.year} · 草稿` : row.year,
          draft: row.draft,
          view: `/admin/preview?${new URLSearchParams({ kind: "film", slug: row.key, locale: "zh" })}`,
          data: {
            ...row,
            draft: row.draft ? "yes" : "no",
            track: row.track ?? "",
            cover: row.cover ?? "",
            accent: row.accent ?? "",
          },
        }))}
        blank={blank}
        blankLabel="新电影"
      />
    </AdminChrome>
  );
}
