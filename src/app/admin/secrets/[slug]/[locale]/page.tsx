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
      section="/admin/secrets"
      blurb={`${slug} · ${locale} · ${secret.kind === "podcast" ? "播客" : "随笔"}`}
      view={secret.draft ? null : `/${locale}/secrets/${slug}`}
      action={
        secret.draft ? (
          <span className="font-mono text-meta uppercase tracking-meta text-accent">
            草稿，未发布
          </span>
        ) : null
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
