import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The home-screen icon for the admin (iOS takes a PNG, not the site's SVG):
 * the name in the sign's ring, on the bricks' near-black — the island's badge,
 * big. Drawn once at build time.
 */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e0e11",
      }}
    >
      <div
        style={{
          width: 128,
          height: 128,
          borderRadius: 64,
          border: "8px solid #3f78ff",
          boxShadow: "0 0 24px #2b57ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f4f1ea",
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        fhf
      </div>
    </div>,
    size,
  );
}
