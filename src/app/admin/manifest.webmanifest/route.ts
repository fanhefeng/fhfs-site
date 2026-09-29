/**
 * What "Add to Home Screen" makes of the admin: an icon that opens straight
 * onto 发一条说说 (the front page), full screen, in the workbench's colours.
 * The proxy's matcher skips paths with a dot, so this is served without a
 * session — as it has to be: the browser fetches it on its own, and it names
 * nothing but a start page that asks for one.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "fhf's 后台",
      short_name: "fhf 后台",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#0e0e11",
      theme_color: "#0e0e11",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/admin/apple-icon", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
