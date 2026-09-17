import { asc } from "drizzle-orm";
import { db } from "@/db";
import { abouts } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { AboutForm } from "./AboutForm";
import { Note } from "../ui/Note";
import { cardClass, metaClass } from "../styles";

export default async function AboutPage() {
  await requireAdminPage();
  const rows = await db.select().from(abouts).orderBy(asc(abouts.locale));
  const byLocale = new Map(rows.map((row) => [row.locale, row]));

  return (
    <AdminChrome title="关于页" section="/admin/about">
      <Note>
        上面的标题字段目前页面并不显示——页面用的是「站点文案」里的 <code>about.title</code>。
      </Note>
      <div className="space-y-6">
        {/* Both locales render whether or not a row exists yet — saveAbout is
            an upsert, so an empty database still offers a way in. */}
        {(["zh", "en"] as const).map((locale) => (
          <section key={locale} className={`${cardClass} p-5 sm:p-6`}>
            <h2 className={metaClass}>{locale === "zh" ? "zh · 中文" : "en · English"}</h2>
            <div className="mt-4">
              <AboutForm about={byLocale.get(locale) ?? { locale, title: "", bodyMd: "" }} />
            </div>
          </section>
        ))}
      </div>
    </AdminChrome>
  );
}
