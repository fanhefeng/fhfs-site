import { asc } from "drizzle-orm";
import { db } from "@/db";
import { chips } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { ChipsForm } from "./ChipsForm";

export default async function ChipsPage() {
  await requireAdminPage();
  const rows = await db
    .select({ label: chips.label, tone: chips.tone })
    .from(chips)
    .orderBy(asc(chips.sort), asc(chips.id));

  return (
    <AdminChrome title="贴纸墙">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        关于页上那面墙。顺序就是显示顺序；两种语言都清空的行会被删掉。
        专有名词（TypeScript、GSAP 之类）只填一边就行，另一边会跟着一样。
      </p>
      <ChipsForm chips={rows} />
    </AdminChrome>
  );
}
