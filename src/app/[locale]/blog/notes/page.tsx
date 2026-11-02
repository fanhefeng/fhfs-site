import { pageLocale } from "@/i18n/page";
import { sectionMetadata } from "@/lib/server/seo";
import { getNotes } from "@/lib/server/notebook";
import { Notebook } from "@/components/notebook/Notebook";

export const generateMetadata = sectionMetadata("notebook", "/blog/notes");

export default async function NotebookPage({ params }: PageProps<"/[locale]/blog/notes">) {
  const locale = await pageLocale(params);
  return <Notebook data={{ locale, notes: getNotes() }} />;
}
