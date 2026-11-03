import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const section = new URL(request.url).searchParams.get("section");
  const destination = section === "life" || section === "writing" ? "/life" : "/blog";
  return Response.redirect(new URL(`/${locale}${destination}`, request.url), 301);
}
