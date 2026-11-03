import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { noteDestination } from "@/lib/notebook";
import { getNotes } from "@/lib/server/notebook";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const note = getNotes().find((item) => item.slug === slug);
  if (!note) return new Response("Not found", { status: 404 });
  return Response.redirect(new URL(`/${locale}${noteDestination(note)}/${slug}`, request.url), 301);
}
