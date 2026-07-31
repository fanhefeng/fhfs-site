import { ImageResponse } from "next/og";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { getAllSlugs, getPost } from "@/lib/content";
import { loadOgFonts, OG, OG_BG, OG_FONT_FAMILY, OG_SIZE } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Metadata image routes do not inherit params from a parent layout's
 * generateStaticParams the way pages do — declare the full locale × slug
 * matrix here or the card is only rendered on first request.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getAllSlugs().map((slug) => ({ locale, slug }))
  );
}

/** CJK glyphs occupy roughly a full em — count them double when fitting. */
function visualLength(text: string) {
  let n = 0;
  for (const ch of text) n += /[　-鿿＀-￯]/.test(ch) ? 2 : 1;
  return n;
}

/** One headline, four steps — keeps long titles inside three lines. */
function titleSize(text: string) {
  const n = visualLength(text);
  if (n <= 20) return 78;
  if (n <= 36) return 64;
  if (n <= 56) return 52;
  return 44;
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
  const other: Locale = l === "zh" ? "en" : "zh";

  const post = getPost(slug, l);
  const title = post?.title ?? site.signName;
  // Bilingual typography: the counterpart title sits under the headline as a
  // quiet second deck. Skipped when the post only exists in one language (in
  // which case getPost falls back and both lookups return the same string).
  const counterpart = getPost(slug, other);
  const subtitle =
    counterpart && counterpart.title !== title ? counterpart.title : null;

  const date = post ? post.date.slice(0, 10).replace(/-/g, ".") : "";
  const meta = [date, ...(post?.tags ?? []).slice(0, 3)]
    .filter(Boolean)
    .join("  ·  ");
  const host = new URL(site.url).host;

  const fonts = await loadOgFonts(
    `${title}${site.signName}`,
    `${subtitle ?? ""}${meta}${host}`
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 84px",
          background: OG_BG,
          color: OG.ink,
          fontFamily: OG_FONT_FAMILY,
        }}
      >
        {/* Meta line: date · tags, led by the amber lamp. */}
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
              letterSpacing: 2,
              color: OG.inkTertiary,
            }}
          >
            {meta}
          </div>
        </div>

        {/* Headline block. */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
          <div
            style={{
              display: "flex",
              fontSize: titleSize(title),
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.18,
              color: OG.ink,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 28,
                fontWeight: 400,
                lineHeight: 1.4,
                color: OG.inkSecondary,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {/* Footer: wordmark, amber rule, host. */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: -1.5,
              color: OG.ink,
            }}
          >
            {site.signName}
          </div>
          <div
            style={{
              display: "flex",
              width: 44,
              height: 4,
              borderRadius: 2,
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
      </div>
    ),
    { ...size, fonts }
  );
}
