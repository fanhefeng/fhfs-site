/**
 * Fetches a text-subset font (TTF) from the Google Fonts CSS API for use in
 * ImageResponse (satori). The default fetch user agent receives truetype URLs.
 */
export async function loadGoogleFont(
  family: string,
  text: string,
  weight = 400
): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family
  )}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/
  );
  if (!resource) throw new Error(`No TTF url for font ${family}`);
  const response = await fetch(resource[1]);
  if (!response.ok) throw new Error(`Failed to fetch font ${family}`);
  return response.arrayBuffer();
}

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_BG =
  "radial-gradient(ellipse 120% 90% at 50% -10%, rgba(76,201,240,0.12), transparent 55%), #0f0f23";
