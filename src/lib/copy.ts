import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
/**
 * The rules of the copy overlay, in one place.
 *
 * `messages/*.json` holds every line the site can say — 885 of them — and is
 * the default. `copy_blocks` holds only the ones that have been edited since:
 * a row is an override, and a key with no row reads as the file says. That is
 * what makes "clear the field" mean *restore the default* rather than "say
 * nothing here", which is the trap the earlier arrangement set.
 *
 * Everything here is pure, and free of the database and of `node:fs`, because
 * both halves of the editor need it: the admin page (server) builds the list
 * from the catalogue, the form (client) renders the group names, and the
 * action checks a value before writing it.
 */

export type CopyLocale = "zh" | "en";

/** A message catalogue, as it comes out of `messages/*.json`. */
export type Catalogue = Record<string, unknown>;

/** One editable line, as the admin shows it. */
export type CopyEntry = {
  key: string;
  /** What the site says now — the override if there is one, else the default. */
  zh: string;
  en: string;
  /** What the files say, which is what clearing the field goes back to. */
  zhDefault: string;
  enDefault: string;
  /** True when a row exists, i.e. this line has been edited away from the file. */
  overridden: boolean;
  /** Read aloud in place of something, never drawn — see `isScreenReaderOnly`. */
  screenReader: boolean;
  note?: string;
};

/**
 * `a.b.c` → string for every string leaf of a catalogue.
 *
 * Only strings: a value of another shape is not a line of copy, and laying a
 * string over it in `merge()` would be refused anyway.
 */
export function flattenCopy(node: Catalogue, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(out, flattenCopy(value as Catalogue, path));
    }
  }
  return out;
}

/** The part before the first dot — the group a line is edited in. */
export function namespaceOf(key: string): string {
  return key.split(".")[0]!;
}

export type CopyGroup = {
  /** The namespace, which is also the group's id in the URL. */
  id: string;
  label: string;
  /** Where these lines are read out front, in one line. */
  blurb: string;
};

/**
 * Every namespace in the catalogue, named for the page it speaks on.
 *
 * The editor is entered through this list, so the names are what someone
 * looking for "the big line on the home page" actually has to recognise —
 * `grove` is not a page anyone has visited. `copy.test.ts` checks the list
 * against the catalogue, so a new namespace cannot arrive unnamed.
 */
export const COPY_GROUPS: CopyGroup[] = [
  { id: "splash", label: "首页 · 霓虹开场", blurb: "直接打开首页时的霓虹招牌和「进入」按钮。" },
  {
    id: "grove",
    label: "首页 · 开场大字",
    blurb:
      "首页第一屏的大字、自我介绍和主按钮；两张卡片的文字现在只用在实验室「滚动开窗，推近苔藓」那一则。",
  },
  { id: "home", label: "首页 · 正文三节", blurb: "软件、文章、最近这三节的标题，和「找到我」。" },
  { id: "blog", label: "文章 /blog", blurb: "列表页和文章页上除正文以外的文字。" },
  { id: "software", label: "软件 /software", blurb: "页面标题、分类名和唱机上的标签。" },
  { id: "lab", label: "实验室 /lab", blurb: "每一则的名字、摘要、说明和演示里的文字。" },
  {
    id: "films",
    label: "电影 /films",
    blurb: "每部电影共用的文字：资料栏的名称、看剧照的按钮。每部片子自己的内容在后台「电影」里。",
  },
  {
    id: "idols",
    label: "偶像 /idols",
    blurb: "列表页的文字，和科比铜像那一节的文字。每位偶像自己的内容在后台「偶像」里。",
  },
  { id: "life", label: "生活 /life", blurb: "/life 目录页的标题和每个栏目的一句介绍。" },
  { id: "moments", label: "说说 /moments", blurb: "说说页上除说说本身以外的文字。" },
  { id: "secrets", label: "秘密 /secrets", blurb: "随笔和播客的列表页、详情页上的固定文字。" },
  { id: "about", label: "关于 /about", blurb: "自述页的标题、副题与贴纸墙提示。" },
  { id: "resume", label: "简历 /resume", blurb: "简历页的抬头与段落标题。" },
  { id: "intro", label: "3D 自我介绍 /intro", blurb: "3D 场景里的标题、标语和结尾。" },
  { id: "nav", label: "导航", blurb: "顶栏、页脚、全屏菜单上每条链接的字。" },
  { id: "search", label: "搜索 ⌘K", blurb: "搜索框的提示、各类结果的名字，和没有结果时的提示。" },
  { id: "footer", label: "页脚", blurb: "版权、时钟两侧的词、贴纸提示。" },
  { id: "tracks", label: "背景音乐", blurb: "每首背景音乐在界面上显示的名字。" },
  { id: "common", label: "通用按钮", blurb: "返回、展开、复制这类到处都在用的词。" },
  {
    id: "error",
    label: "报错页",
    // global-error.tsx renders above the layout, with no provider to carry an
    // override — it reads ERROR_COPY, a copy of the files' `error` lines.
    blurb:
      "页面出错时显示的文字。只对页面内的报错生效；整个布局出错时显示的是代码里的副本，这里的修改对它无效。",
  },
  {
    id: "notFound",
    label: "404",
    // global-not-found.tsx, for addresses outside /zh and /en, imports the
    // JSON files directly for the same reason.
    blurb:
      "404 页的文字。/zh、/en 下的地址用这里的文字；语言前缀都不对的地址显示全局 404，那一页直接读语言文件。",
  },
  { id: "layout", label: "站点标题", blurb: "浏览器标签页上的那一行。" },
];

/** A reminder about a line that is load-bearing in a way the value cannot show. */
export const COPY_NOTES: Record<string, string> = {
  "grove.headline1": "首页满屏的那句话。写短——它排得很大。",
  "grove.headline2":
    "第二行，可留空：空的时候开场就是一行（Opening 会丢掉空行）。留空即恢复默认，而默认本来就是空的。",
  "home.sloganEcho": "永远是 home.slogan 的另一种语言版本。",
  "footer.timePrefix":
    "和 footer.timeSuffix 是一对语序：中文把城市放在钟前面，英文放后面。两条一起改。",
  "footer.timeSuffix": "见 footer.timePrefix。",
};

/**
 * Lines nobody sees: a control's accessible name, an image's alternative text,
 * a live region's heading.
 *
 * Worth marking in the editor because they are edited by a different measure.
 * Nothing on the page shows them, so they can't be checked by looking; they
 * are read aloud in place of something — a switch, a photograph — so they say
 * what it *is*, not what pressing it would do (a name that flips with state
 * gets read as "turn the sign off, pressed"); and they must not be trimmed
 * for the layout's sake, because they have no layout.
 *
 * The house naming convention carries most of it: `…Aria` for an accessible
 * name, `…Alt` / `.alt` for alternative text — so a new one named that way
 * marks itself. `COPY_SR_EXTRA` is the rest, the ones named for what they say
 * rather than for where they go (`splash.sign` is the neon's accessible name,
 * `nav.menu` names the hamburger). Add to it when a line lands in an
 * `aria-label`, an `alt` or an `sr-only` node under some other name;
 * `copy.test.ts` checks these keys exist and that none of them is one the
 * suffix rule already covers.
 */
export const COPY_SR_EXTRA = new Set([
  "splash.label",
  "splash.sign",
  "nav.ariaLabel",
  "nav.menu",
  "common.lightSwitch",
  "common.music",
  "grove.cardLabLink",
  "grove.cardNoteLink",
  "intro.resumeRegion",
  "lab.studyNav",
  "lab.items.lensSlider.prev",
  "lab.items.lensSlider.next",
  "lab.items.segmented.ariaLabel",
  "lab.items.reshuffle.ariaLabel",
  "lab.items.neon.signOn",
  "lab.items.workstation.turnLeft",
  "lab.items.workstation.turnRight",
  "lab.items.grove.dressLegend",
  "films.viewer.open",
  "films.viewer.prev",
  "films.viewer.next",
  "idols.kobe.turnLeft",
  "idols.kobe.turnRight",
]);

/** True when this line is only ever read aloud — never drawn on the page. */
export function isScreenReaderOnly(key: string): boolean {
  const last = key.slice(key.lastIndexOf(".") + 1);
  return last === "alt" || /(?:Aria|Alt)$/.test(last) || COPY_SR_EXTRA.has(key);
}

/**
 * The `{name}` arguments and `<tag>` names an ICU message carries, or null
 * when the line does not parse as ICU at all.
 *
 * next-intl formats every line through ICU, so these are not decoration: an
 * argument the call site does not pass, or a tag `t.rich` has no function for,
 * throws at render time — on the public page, not here.
 *
 * Read with the ICU parser next-intl's own formatter is built on, not with a
 * pattern: in `{count, plural, =0 {no apps} other {# apps}}` the braces also
 * hold the branches, and a regex took the `no` of "no apps" for an argument —
 * so rewording a branch was refused for an argument the default "lacked".
 */
export function icuTokens(value: string): { args: string[]; tags: string[] } | null {
  let ast: MessageFormatElement[];
  try {
    ast = parse(value);
  } catch {
    return null;
  }
  const args = new Set<string>();
  const tags = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
      if (el.type === TYPE.tag) {
        tags.add(el.value);
        walk(el.children);
      } else if (el.type === TYPE.plural || el.type === TYPE.select) {
        args.add(el.value);
        for (const option of Object.values(el.options)) walk(option.value);
      } else {
        args.add(el.value);
      }
    }
  };
  walk(ast);
  return { args: [...args], tags: [...tags] };
}

/**
 * What is wrong with an edited line, measured against the file it overrides —
 * or null when it is safe to save.
 *
 * Only what the default can prove: an argument or a tag the default does not
 * have is one nothing will pass at render time, and unbalanced braces do not
 * parse at all. Saying *less* than the default is allowed — dropping `{count}`
 * from a sentence is a real edit, not a mistake.
 */
export function copyError(value: string, fallback: string): string | null {
  let depth = 0;
  for (const char of value) {
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (depth < 0) return "多了一个 }。";
  }
  if (depth > 0) return "有 { 没有关上。";

  const here = icuTokens(value);
  if (!here) return "这一行的 ICU 写法看不懂——多半是 plural / select 的分支格式不对，站上会报错。";
  const base = icuTokens(fallback) ?? { args: [], tags: [] };
  const extraArg = here.args.find((arg) => !base.args.includes(arg));
  if (extraArg)
    return `默认文案里没有 {${extraArg}}，站上会报错。可以用的：${listOf(base.args, "{", "}")}`;
  const extraTag = here.tags.find((tag) => !base.tags.includes(tag));
  if (extraTag)
    return `默认文案里没有 <${extraTag}> 这个标签，站上会报错。可以用的：${listOf(base.tags, "<", ">")}`;
  return null;
}

function listOf(names: string[], open: string, close: string): string {
  return names.length ? names.map((name) => `${open}${name}${close}`).join("、") : "一个都没有";
}
