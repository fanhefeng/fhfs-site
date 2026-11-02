import { readFile, mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { catalog } from "./notebook/catalog";
import { renderMarkdown } from "../src/lib/server/markdown";
import { readingMinutes } from "../src/lib/reading";
import type { NoteBody, NoteSummary } from "../src/lib/notebook";

const vault = process.argv[2];
if (!vault) throw new Error("Usage: pnpm import:notebook /absolute/path/to/Obsidian/note");
const output = resolve(dirname(fileURLToPath(import.meta.url)), "../src/content/notebook");
const slugs = new Set<string>();
const summaries: NoteSummary[] = [];
const pages: { slug: string; body: NoteBody }[] = [];

// Prepare everything before writing: a missing source must not leave a partial import.
for (const { file, selection, ...entry } of catalog) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || slugs.has(entry.slug))
    throw new Error(`Invalid or duplicate slug: ${entry.slug}`);
  slugs.add(entry.slug);
  let markdown = await readFile(resolve(vault, file), "utf8");
  markdown = markdown.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/, (_all, yaml) => {
    const front = parse(yaml);
    if (front.date && front.date !== entry.date) throw new Error(`Review the date for ${file}`);
    return "";
  });
  if (selection === "canteen") {
    const versions = markdown.split(/\n---\n/);
    if (!versions[1]?.trim().startsWith("应该加一个标题"))
      throw new Error(`Review article version selection: ${file}`);
    markdown = versions[0]!;
  }
  if (selection === "fragments") {
    const fragments = markdown.replace(/^# .+\n/, "").split(/\n---\n/);
    const first = fragments[0]!.split("> 『关于奋斗』")[1];
    const selected = ["2023年去北京的时候", "每个困惑的背后", "无论在什么地方", "湛蓝的天"].map(
      (start) => fragments.find((part) => part.trim().startsWith(start)),
    );
    if (!first || selected.some((part) => !part))
      throw new Error(`Review fragment selection: ${file}`);
    markdown = [first, ...selected].join("\n\n---\n\n");
  }
  if (selection === "web3") {
    if (!markdown.includes("## 二、") || !markdown.includes("## 技术学习"))
      throw new Error(`Review technical section selection: ${file}`);
    const intro = markdown.split("## 二、")[0]!;
    markdown = `${intro}\n\n## 技术学习${markdown.split("## 技术学习")[1]!}`;
  }
  if (selection === "reference") {
    const source = entry.source!;
    markdown = `## ${entry.locale === "en" ? "Reading reference" : "阅读资料"}\n\n${source.author} · ${source.title}\n\n${source.url ? `[${entry.locale === "en" ? "Read the original" : "阅读原文"}](${source.url})` : "原笔记未记录可核实的原文网址，暂保留书目信息。"}`;
  }
  markdown = markdown
    .replace(/^\s*# [^\n]+\n/, "")
    .replace(/^>\s*\[![\w-]+\][+-]?[ \t]*([^\n]*)$/gm, (_all, title: string) =>
      title ? `> **${title}**` : ">",
    )
    .trim();
  markdown = Array.from(markdown)
    .filter((char) => char.charCodeAt(0) >= 32 || "\t\n\r".includes(char))
    .join("");
  if (!markdown || /\[\[|!\[.*?\]\((?!https?:\/\/|\/|#)/.test(markdown))
    throw new Error(`Empty content or unresolved Obsidian attachment/link: ${file}`);
  if (
    /(?:-----BEGIN .*PRIVATE KEY|(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{20,}|(?:privateKey|api[_-]?key|secret|password)\s*[:=]\s*["'][A-Za-z0-9+/_=-]{20,}["'])/i.test(
      markdown,
    )
  )
    throw new Error(`Review potential credential in ${file}`);
  let html = await renderMarkdown(markdown);
  // A wide reference table scrolls inside the reading column, never the page.
  html = html
    .replace(/<table>/g, '<div class="overflow-x-auto"><table>')
    .replace(/<\/table>/g, "</table></div>");
  const toc = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((match) => ({
    id: match[1]!,
    title: match[2]!
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  }));
  summaries.push({ ...entry, readingMinutes: readingMinutes(markdown) });
  pages.push({ slug: entry.slug, body: { html, toc } });
}
await mkdir(resolve(output, "pages"), { recursive: true });
for (const { slug, body } of pages)
  await writeFile(resolve(output, "pages", `${slug}.json`), `${JSON.stringify(body, null, 2)}\n`);
for (const name of await readdir(resolve(output, "pages")))
  if (name.endsWith(".json") && !slugs.has(name.slice(0, -5)))
    await unlink(resolve(output, "pages", name));
await writeFile(resolve(output, "index.json"), `${JSON.stringify(summaries, null, 2)}\n`);
console.log(
  `Imported ${summaries.length} selected entries. The vault and database were not modified.`,
);
