import { asc } from "drizzle-orm";
import { db } from "@/db";
import { abouts } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";
import { AboutForm } from "./AboutForm";

export default async function AboutPage() {
  const rows = await db.select().from(abouts).orderBy(asc(abouts.locale));
  const byLocale = new Map(rows.map((row) => [row.locale, row]));

  return (
    <AdminChrome title="关于页">
      <p className="mb-8 max-w-[70ch] text-caption text-fg-tertiary">
        关于页正文，两种语言各一份。上面的标题字段目前页面并不显示——
        页面用的是「站点文案」里的 <code>about.title</code>。
      </p>
      <div className="space-y-12">
        {/* Both locales render whether or not a row exists yet — saveAbout is
            an upsert, so an empty database still offers a way in. */}
        {(["zh", "en"] as const).map((locale) => (
          <section key={locale}>
            <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {locale}
            </h2>
            <div className="mt-3">
              <AboutForm
                about={byLocale.get(locale) ?? { locale, title: "", bodyMd: "" }}
              />
            </div>
          </section>
        ))}
      </div>
    </AdminChrome>
  );
}
