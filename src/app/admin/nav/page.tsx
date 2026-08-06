import { asc } from "drizzle-orm";
import { db } from "@/db";
import { navItems } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";
import { NavForm } from "./NavForm";

export default async function NavPage() {
  const rows = await db
    .select({
      href: navItems.href,
      labelKey: navItems.labelKey,
      surfaces: navItems.surfaces,
    })
    .from(navItems)
    .orderBy(asc(navItems.sort), asc(navItems.href));

  return (
    <AdminChrome title="导航">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        一条链接可以同时出现在好几个地方。文案 key 指向 <code>messages</code> 里的
        <code> nav.&lt;key&gt;</code>——那些界面标签不在数据库里，加新条目要顺手在
        两个 JSON 里补上对应的词，否则显示出来的会是 key 本身。清空路径即删除。
      </p>
      <NavForm items={rows} />
    </AdminChrome>
  );
}
