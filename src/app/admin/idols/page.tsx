import { asc } from "drizzle-orm";
import { db } from "@/db";
import { idols } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth/session";
import { STATUE_IDOL } from "@/lib/idols";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../ui/RecordList";
import { deleteIdol, saveIdol } from "../actions/idols";
import type { Field, RecordData } from "../ui/RecordForm";
import { Note } from "../ui/Note";

const EMPTY = { zh: "", en: "" };

const FIELDS: Field[] = [
  {
    name: "key",
    label: "key（网址 /idols/…）",
    kind: "text",
    readOnly: true,
    placeholder: "kobe",
    hint: "存下来就不能改：它是这一页的网址。",
  },
  { name: "name", label: "名字", kind: "localized" },
  {
    name: "draft",
    label: "草稿",
    kind: "select",
    options: ["no", "yes"],
    hint: "yes 的时候只有后台的「在站上看」看得到，写好了再改成 no。",
  },
  { name: "kicker", label: "名字上面那行小字", kind: "localized", hint: "比如「偶像 · 第一位」。" },
  {
    name: "latin",
    label: "另一种文字的名字",
    kind: "localized",
    hint: "印在名字下面那行的开头。",
  },
  { name: "years", label: "生卒年", kind: "text", placeholder: "1978 – 2020" },
  {
    name: "numbers",
    label: "号码",
    kind: "text",
    placeholder: "8 · 24",
    hint: "那行末尾的强调色。",
  },
  { name: "lede", label: "导语", kind: "localizedArea" },

  {
    name: "cover",
    label: "封面（照片的 id）",
    kind: "text",
    hint: "/idols 卡片上那张，竖着裁。留空就用第一张。",
    group: "样子与排序",
  },
  {
    name: "accent",
    label: "主色（hex）",
    kind: "text",
    placeholder: "#5b3f8a",
    hint: "只有排第一的那位用得到：/life 上偶像那一行悬停时的色条。",
    group: "样子与排序",
  },
  { name: "sort", label: "排序", kind: "number", group: "样子与排序" },

  { name: "galleryKicker", label: "小标题", kind: "localized", group: "照片" },
  { name: "galleryTitle", label: "标题", kind: "localized", group: "照片" },
  { name: "galleryLede", label: "导语", kind: "localizedArea", group: "照片" },
  {
    name: "photos",
    label: "每一张",
    kind: "rows",
    group: "照片",
    hint: "别人拍的照片要写清作者、授权和出处——每张下面都会印出来。上传会自动填好地址、宽高和 id。",
    rows: {
      noun: "张",
      pictures: "idols",
      blank: {
        id: "",
        src: "",
        width: "",
        height: "",
        author: "",
        licence: "",
        page: "",
        title: EMPTY,
        meta: EMPTY,
        alt: EMPTY,
      },
      fields: [
        { name: "id", label: "id", kind: "text", mono: true },
        { name: "width", label: "宽（像素）", kind: "number" },
        { name: "height", label: "高（像素）", kind: "number" },
        { name: "licence", label: "授权", kind: "text", placeholder: "CC BY-SA 2.0" },
        { name: "src", label: "地址", kind: "text", mono: true, wide: true },
        { name: "author", label: "作者", kind: "text" },
        {
          name: "page",
          label: "出处（授权和原图所在的页面）",
          kind: "text",
          mono: true,
          wide: true,
        },
        { name: "title", label: "标题", kind: "localized" },
        { name: "meta", label: "哪里 · 哪年", kind: "localized" },
        { name: "alt", label: "读屏：照片里是什么", kind: "localized" },
      ],
    },
  },

  { name: "timelineKicker", label: "小标题", kind: "localized", group: "时间线" },
  { name: "timelineTitle", label: "标题", kind: "localized", group: "时间线" },
  {
    name: "timeline",
    label: "每一件事",
    kind: "rows",
    group: "时间线",
    rows: {
      noun: "条",
      blank: { date: "", title: EMPTY, note: EMPTY },
      fields: [
        { name: "date", label: "日期（照原样印）", kind: "text", placeholder: "1996.06" },
        { name: "title", label: "发生了什么", kind: "localized" },
        { name: "note", label: "一句说明", kind: "localizedArea", rows: 2 },
      ],
    },
  },
  { name: "credit", label: "页脚的版权说明", kind: "localizedArea", group: "时间线" },
];

export default async function IdolsAdminPage() {
  await requireAdminPage();
  const rows = await db.select().from(idols).orderBy(asc(idols.sort), asc(idols.key));

  const blank: RecordData = {
    key: "",
    name: EMPTY,
    draft: "yes",
    kicker: EMPTY,
    latin: EMPTY,
    years: "",
    numbers: "",
    lede: EMPTY,
    cover: "",
    accent: "",
    sort: (rows.at(-1)?.sort ?? -1) + 1,
    galleryKicker: EMPTY,
    galleryTitle: EMPTY,
    galleryLede: EMPTY,
    photos: [],
    timelineKicker: EMPTY,
    timelineTitle: EMPTY,
    timeline: [],
    credit: EMPTY,
  };

  return (
    <AdminChrome title="偶像" section="/admin/idols">
      <Note>
        一位一页，/idols/key。科比那一页的铜像是代码写的，只跟着 key「{STATUE_IDOL}
        」出现，它周围的字在「站点文案」的偶像分组里。
      </Note>
      <RecordList
        action={saveIdol}
        deleteAction={deleteIdol}
        fields={FIELDS}
        unit="位"
        rows={rows.map((row) => ({
          id: row.key,
          label: row.name.zh || row.name.en,
          meta: row.draft ? `${row.years} · 草稿` : row.years,
          draft: row.draft,
          view: `/admin/preview?${new URLSearchParams({ kind: "idol", slug: row.key, locale: "zh" })}`,
          data: {
            ...row,
            draft: row.draft ? "yes" : "no",
            cover: row.cover ?? "",
            accent: row.accent ?? "",
          },
        }))}
        blank={blank}
        blankLabel="新偶像"
      />
    </AdminChrome>
  );
}
