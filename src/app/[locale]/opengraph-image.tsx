import { ImageResponse } from "next/og";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { loadOgFonts, OG, OG_BG, OG_FONT_FAMILY, OG_SIZE } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Site cover card: warm paper, one amber glow, the wordmark set large and
 * low like a magazine cover, the tagline under an amber rule. No glass and
 * no glow effects — satori renders neither, and the print voice wants ink.
 */
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
  const host = new URL(site.url).host;

  const fonts = await loadOgFonts(site.signName, `${tagline}${host}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px",
          background: OG_BG,
          color: OG.ink,
          fontFamily: OG_FONT_FAMILY,
        }}
      >
        {/* Masthead line — the amber dot is the site's lit lamp. */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 7,
              background: OG.accent,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: 3,
              color: OG.inkTertiary,
            }}
          >
            {host}
          </div>
        </div>

        {/* Cover block, bottom-aligned: wordmark → rule → tagline. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 176,
              fontWeight: 700,
              letterSpacing: -10,
              lineHeight: 1,
              color: OG.ink,
            }}
          >
            {site.signName}
          </div>
          <div
            style={{
              display: "flex",
              width: 88,
              height: 6,
              borderRadius: 3,
              background: OG.accent,
              marginTop: 34,
            }}
          />
          <div
            style={{
              display: "flex",
              maxWidth: 900,
              marginTop: 30,
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.5,
              color: OG.inkSecondary,
            }}
          >
            {tagline}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
