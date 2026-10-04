/**
 * The admin's own table of contents, grouped the way the front of the site is.
 *
 * The groups are the site's own: `issue` / `rooms` / `me` are the same three
 * the navigation table sorts into (`nav_items.group`), so a section is found
 * here by remembering where its page sits out front, not by remembering which
 * table it happens to live in. `site` is the fourth, and holds what has no page
 * of its own — copy and navigation.
 *
 * `/admin/works` is deliberately not listed. The shelf the old /portfolio read
 * is kept — the table, the editor, `saveWork` — for the day a first work is
 * hung (docs/DESIGN-LOG.md, 09-14), but it is empty and nothing out front reads
 * it, so it left the sidebar and the dashboard (2026-09-29) rather than sit
 * there as a section with nothing to do. Its editor still answers at its
 * address.
 *
 * Like `./styles`, this file imports nothing, and for the same reason: the
 * sidebar is a client component, and reaching for `@/db/schema` to name a table
 * here would drag the whole drizzle schema into the browser. The tables live in
 * `./counts`, which is server-only.
 */

export type AdminSection = {
  /** Where the editor for it lives. Also its identity in `counts`. */
  href: string;
  label: string;
  /** What editing it actually changes, in one line — shown under the title. */
  blurb: string;
  /** The page out front, as a path under `/zh`, or null when it has none. */
  view: string | null;
  /** The unit its count is spoken in: 6 篇, 242 条, 23 张. */
  unit: string;
};

/** Row counts keyed by section href. Filled in by `./counts`, which is the
 *  server half — the type lives here so the sidebar can name it without
 *  importing a module that pulls in the database. */
export type SectionCounts = { [href: string]: number };

export type AdminGroup = {
  id: string;
  label: string;
  /** The group's own line, on the dashboard. */
  caption: string;
  sections: AdminSection[];
};

export const SECTION_GROUPS: AdminGroup[] = [
  {
    id: "issue",
    label: "作品",
    caption: "文章和软件。实验室（/lab）的内容写在代码里，不在这里。",
    sections: [
      {
        href: "/admin/posts",
        label: "文章",
        blurb: "/blog 的列表与每篇详情。一篇一语言，中英各算一条。",
        view: "/blog",
        unit: "篇",
      },
      {
        href: "/admin/apps",
        label: "软件",
        blurb: "/software 上的每个应用。版本号不用填，填仓库地址后站点会自己读取。",
        view: "/software",
        unit: "款",
      },
    ],
  },
  {
    id: "rooms",
    label: "生活",
    caption: "说说、随笔、电影和偶像，各有自己的页面。",
    sections: [
      {
        href: "/admin/moments",
        label: "说说",
        blurb: "/moments 上的说说，一条几行字加一个时间。",
        view: "/moments",
        unit: "条",
      },
      {
        href: "/admin/secrets",
        label: "秘密",
        blurb: "/secrets 的随笔与播客。和文章同构，多了音频和时长。",
        view: "/secrets",
        unit: "篇",
      },
      {
        href: "/admin/films",
        label: "电影",
        blurb: "/films 的每一部：简介、台词、剧照墙。一部一页。",
        view: "/films",
        unit: "部",
      },
      {
        href: "/admin/idols",
        label: "偶像",
        blurb: "/idols 的每一位：照片和出处、时间线。一位一页。",
        view: "/idols",
        unit: "位",
      },
    ],
  },
  {
    id: "me",
    label: "关于我",
    caption: "关于页、3D 自我介绍和简历。",
    sections: [
      {
        href: "/admin/about",
        label: "关于页",
        blurb: "/about 的正文，中英各一份。",
        view: "/about",
        unit: "份",
      },
      {
        href: "/admin/timeline",
        label: "版本履历",
        blurb: "实验室「跟随滚动的年份轴」用的数据，按软件版本号的格式记个人经历。",
        view: "/lab/changelog",
        unit: "版",
      },
      {
        href: "/admin/intro",
        label: "简历节点",
        blurb: "/intro 的 3D 场景里每个节点的文字。",
        view: "/intro",
        unit: "个",
      },
      {
        href: "/admin/resume",
        label: "简历页",
        blurb: "/resume 的抬头、技术栈和履历；履历那几行 /about 也在用。公开页不写公司名。",
        view: "/resume",
        unit: "段",
      },
      {
        href: "/admin/chips",
        label: "贴纸墙",
        blurb: "/about 页面上可以拖动的贴纸。",
        view: "/about",
        unit: "张",
      },
    ],
  },
  {
    id: "site",
    label: "站点",
    caption: "不属于某一页的内容：全站文案和导航。",
    sections: [
      {
        href: "/admin/copy",
        label: "站点文案",
        blurb:
          "全站每一行字，按页面分组。默认在 messages/*.json，这里只存改过的——清空一条就回到默认。",
        view: null,
        // The count is how many lines have been edited away from the files,
        // not how many there are: 634 of those, and none of them a row.
        unit: "条改过",
      },
      {
        href: "/admin/nav",
        label: "导航",
        blurb: "顶栏、页脚、全屏菜单和站点地图上分别出现哪几条。",
        view: null,
        unit: "条",
      },
    ],
  },
];

/** Flat, in the same order — for lookups by href. */
export const SECTIONS: AdminSection[] = SECTION_GROUPS.flatMap((group) => group.sections);

export function sectionByHref(href: string): AdminSection | undefined {
  return SECTIONS.find((section) => section.href === href);
}

/** The group a section belongs to, for the breadcrumb. */
export function groupOf(href: string): AdminGroup | undefined {
  return SECTION_GROUPS.find((group) => group.sections.some((section) => section.href === href));
}
