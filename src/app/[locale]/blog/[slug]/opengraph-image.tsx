import { ImageResponse } from "next/og";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { getAllSlugs, getPost } from "@/lib/content";
import { loadGoogleFont, OG_SIZE, OG_BG } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export default async function PostOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const l = (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  const post = getPost(slug, l);
  const title = post?.title ?? site.signName;

  const [signFont, titleFont] = await Promise.all([
    loadGoogleFont("Monoton", site.signName),
    loadGoogleFont("Noto Serif SC", title, 600),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          padding: 80,
          background: OG_BG,
        }}
      >
        <div
          style={{
            fontFamily: "NotoSerifSC",
            fontSize: 56,
            lineHeight: 1.3,
            color: "#f5f0e8",
            textAlign: "center",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "Monoton",
            fontSize: 44,
            color: "#ff4d6d",
            textShadow:
              "0 0 10px rgba(255,77,109,0.9), 0 0 30px rgba(255,77,109,0.5)",
          }}
        >
          {site.signName}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Monoton", data: signFont, weight: 400 },
        { name: "NotoSerifSC", data: titleFont, weight: 600 },
      ],
    }
  );
}
