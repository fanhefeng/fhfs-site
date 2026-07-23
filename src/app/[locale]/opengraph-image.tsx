import { ImageResponse } from "next/og";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { loadGoogleFont, OG_SIZE, OG_BG } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  const tagline = site.description[l];

  const [signFont, textFont] = await Promise.all([
    loadGoogleFont("Monoton", site.signName),
    loadGoogleFont("Noto Serif SC", tagline, 600),
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
          gap: 28,
          background: OG_BG,
        }}
      >
        <div
          style={{
            fontFamily: "Monoton",
            fontSize: 130,
            color: "#ff4d6d",
            textShadow:
              "0 0 14px rgba(255,77,109,0.9), 0 0 40px rgba(255,77,109,0.5)",
          }}
        >
          {site.signName}
        </div>
        <div
          style={{
            fontFamily: "NotoSerifSC",
            fontSize: 30,
            color: "#e8b44f",
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Monoton", data: signFont, weight: 400 },
        { name: "NotoSerifSC", data: textFont, weight: 600 },
      ],
    }
  );
}
