/**
 * The admin's own table of contents, grouped the way the front of the site is.
 *
 * The groups are the site's own: `issue` / `rooms` / `me` are the same three
 * the navigation table sorts into (`nav_items.group`), so a section is found
 * here by remembering where its page sits out front, not by remembering which
 * table it happens to live in. `site` is the fourth, and holds what has no page
 * of its own — copy, navigation, the retired shelf.
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
    label: "本期",
    caption: "站点当期在讲的事：写的、做的。试的那些（/lab）写在代码里，不在这儿。",
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
        blurb: "/software 上的每张卡片。版本号不填，填仓库让站点自己去读。",
        view: "/software",
        unit: "款",
      },
    ],
  },
  {
    id: "rooms",
    label: "房间",
    caption: "推门进去各有各的样子，内容也各写各的。",
    sections: [
      {
        href: "/admin/moments",
        label: "说说",
        blurb: "/moments 那面板子上的短句，一条几行字加一个时刻。",
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
        href: "/admin/timeline",
        label: "版本履历",
        blurb: "/life 上那串版本号——一生按软件发布来记。",
        view: "/life",
        unit: "版",
      },
    ],
  },
  {
    id: "me",
    label: "关于我",
    caption: "同一个人的三种讲法：一页自述、一幕 3D、一份简历。",
    sections: [
      {
        href: "/admin/about",
        label: "关于页",
        blurb: "/about 的正文，中英各一份。",
        view: "/about",
        unit: "份",
      },
      {
        href: "/admin/intro",
        label: "简历节点",
        blurb: "/intro 那个 3D 场景里浮着的节点文字。",
        view: "/intro",
        unit: "个",
      },
      {
        href: "/admin/resume",
        label: "简历页",
        blurb: "/resume 的抬头与每段经历。公开页不写真实公司名。",
        view: "/resume",
        unit: "段",
      },
      {
        href: "/admin/chips",
        label: "贴纸墙",
        blurb: "/about 页面上那堆可以拖的纸片。",
        view: "/about",
        unit: "张",
      },
    ],
  },
  {
    id: "site",
    label: "站点",
    caption: "没有单独页面的那些：全站通用的字、路，和已经下线的架子。",
    sections: [
      {
        href: "/admin/copy",
        label: "站点文案",
        blurb: "覆盖 messages/*.json 的默认文案。写什么就是什么——清空一条，站上那处就是空的。",
        view: null,
        unit: "条",
      },
      {
        href: "/admin/nav",
        label: "导航",
        blurb: "顶栏、页脚、全屏菜单和站点地图上分别出现哪几条。",
        view: null,
        unit: "条",
      },
      {
        href: "/admin/works",
        label: "作品集",
        blurb: "旧的 /portfolio 留下的架子——该页已 308 到 /software，目前前台没有入口。",
        view: null,
        unit: "件",
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
