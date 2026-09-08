import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { secrets } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../../../AdminChrome";
import { SecretForm } from "../../SecretForm";

export default async function EditSecret({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  await requireAdminPage();
  const { slug, locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();

  const [secret] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.slug, slug), eq(secrets.locale, locale)))
    .limit(1);
  if (!secret) notFound();

  return (
    <AdminChrome
      title={secret.title}
      action={
        secret.draft ? (
          <span className="text-caption text-fg-tertiary">草稿，未发布</span>
        ) : (
          <a
            href={`/${locale}/secrets/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-caption text-fg-tertiary hover:text-accent"
          >
            在站上看 ↗
          </a>
        )
      }
    >
      <SecretForm
        isNew={false}
        secret={{
          slug: secret.slug,
          locale: secret.locale,
          kind: secret.kind,
          title: secret.title,
          date: secret.date,
          summary: secret.summary,
          audio: secret.audio ?? "",
          duration: secret.duration == null ? "" : String(secret.duration),
          draft: secret.draft,
          bodyMd: secret.bodyMd,
        }}
      />
    </AdminChrome>
  );
}
